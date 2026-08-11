import React, { useState, useMemo } from "react";

// ---- Scoring logic -------------------------------------------------------
function computeRoundScore(round, bid, tricks, bonus) {
  const success = bid === tricks;
  if (bid === 0) {
    const base = success ? 10 * round : -10 * round;
    return base + (success ? bonus : 0);
  }
  if (success) return 20 * bid + bonus;
  return -10 * Math.abs(bid - tricks);
}

const BONUS_CHIPS = [
  { key: "card14color", label: "Carte 14 de couleur en fin de manche", points: 10, short: "+10" },
  { key: "card14black", label: "Carte 14 noire (Drapeau pirate) en fin de manche", points: 20, short: "+20" },
  { key: "mermaidByPirate", label: "Sirène capturée par un pirate", points: 20, short: "+20" },
  { key: "pirateBySk", label: "Pirate capturé par Skull King", points: 30, short: "+30" },
  { key: "skByMermaid", label: "Sirène capture Skull King", points: 40, short: "+40" },
];

const TOTAL_ROUNDS = 10;

// ---- Palette: deep purple/black cover outside, aged parchment pages inside ----
const PALETTE = {
  bgDeep: "#0a0612",
  bgPurple: "#1c1030",
  bgPurpleSoft: "#2a1a42",
  parchment: "#ecdfbd",
  parchmentDark: "#e2d2a8",
  parchmentShadow: "#c9b689",
  ink: "#3a2a16",
  inkDim: "#6e5a3c",
  gold: "#c9a24b",
  goldBright: "#e0bc6a",
  goldDark: "#8a6a1f",
  cream: "#ede3cd",
  creamDim: "#b8a9c4",
  crimson: "#7a2020",
  crimsonBright: "#a83232",
  green: "#3f6b32",
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function SkullKingScorer() {
  const [phase, setPhase] = useState("setup"); // setup | playing | editing | finished
  const [players, setPlayers] = useState([
    { id: uid(), name: "", photo: null },
    { id: uid(), name: "", photo: null },
  ]);
  const [rounds, setRounds] = useState([]); // completed rounds
  const [roundNum, setRoundNum] = useState(1);
  const [draft, setDraft] = useState({}); // playerId -> {bid, tricks, bonus, bonusDetail} — manche en cours
  const [expandedBonus, setExpandedBonus] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editingRound, setEditingRound] = useState(null); // round number being re-edited
  const [editDraft, setEditDraft] = useState({}); // brouillon séparé, utilisé uniquement en édition
  const [phaseBeforeEdit, setPhaseBeforeEdit] = useState("playing"); // phase à restaurer après édition

  const totals = useMemo(() => {
    const t = {};
    players.forEach((p) => (t[p.id] = 0));
    rounds.forEach((r) => {
      players.forEach((p) => {
        const e = r.entries[p.id];
        if (e) t[p.id] += e.score;
      });
    });
    return t;
  }, [rounds, players]);

  const ranking = useMemo(() => {
    return [...players]
      .map((p) => ({ ...p, total: totals[p.id] ?? 0 }))
      .sort((a, b) => b.total - a.total);
  }, [players, totals]);

  // ---- setup handlers -----------------------------------------------------
  function addPlayer() {
    if (players.length >= 8) return;
    setPlayers([...players, { id: uid(), name: "", photo: null }]);
  }
  function removePlayer(id) {
    if (players.length <= 2) return;
    setPlayers(players.filter((p) => p.id !== id));
  }
  function renamePlayer(id, name) {
    setPlayers(players.map((p) => (p.id === id ? { ...p, name } : p)));
  }
  function setPlayerPhoto(id, dataUrl) {
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, photo: dataUrl } : p)));
  }
  function startGame() {
    const named = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || `Joueur ${i + 1}`,
    }));
    setPlayers(named);
    initDraft(named, 1);
    setPhase("playing");
  }

  function initDraft(playerList, rn) {
    const d = {};
    playerList.forEach((p) => {
      d[p.id] = { bid: 0, tricks: 0, bonus: 0, bonusDetail: {} };
    });
    setDraft(d);
    setRoundNum(rn);
  }

  // ---- round entry handlers (manche en cours) -------------------------------------------------
  function setField(playerId, field, value) {
    setDraft((d) => ({
      ...d,
      [playerId]: {
        ...d[playerId],
        [field]: Math.max(0, Math.min(TOTAL_ROUNDS, value)),
      },
    }));
  }

  function addBonus(playerId, chipKey, points) {
    setDraft((d) => {
      const current = d[playerId];
      const detail = { ...current.bonusDetail };
      detail[chipKey] = (detail[chipKey] || 0) + 1;
      return {
        ...d,
        [playerId]: {
          ...current,
          bonus: current.bonus + points,
          bonusDetail: detail,
        },
      };
    });
  }

  function resetBonus(playerId) {
    setDraft((d) => ({
      ...d,
      [playerId]: { ...d[playerId], bonus: 0, bonusDetail: {} },
    }));
  }

  function submitRound() {
    const entries = {};
    players.forEach((p) => {
      const dr = draft[p.id] || { bid: 0, tricks: 0, bonus: 0 };
      entries[p.id] = {
        bid: dr.bid,
        tricks: dr.tricks,
        bonus: dr.bonus,
        score: computeRoundScore(roundNum, dr.bid, dr.tricks, dr.bonus),
      };
    });

    const newRounds = [...rounds, { roundNumber: roundNum, entries }];
    setRounds(newRounds);

    if (roundNum >= TOTAL_ROUNDS) {
      setPhase("finished");
    } else {
      initDraft(players, roundNum + 1);
    }
  }

  // ---- round entry handlers (édition d'une manche passée) -------------------------------------------------
  function setEditField(playerId, field, value) {
    setEditDraft((d) => ({
      ...d,
      [playerId]: {
        ...d[playerId],
        [field]: Math.max(0, Math.min(TOTAL_ROUNDS, value)),
      },
    }));
  }

  function addEditBonus(playerId, chipKey, points) {
    setEditDraft((d) => {
      const current = d[playerId];
      const detail = { ...current.bonusDetail };
      detail[chipKey] = (detail[chipKey] || 0) + 1;
      return {
        ...d,
        [playerId]: {
          ...current,
          bonus: current.bonus + points,
          bonusDetail: detail,
        },
      };
    });
  }

  function resetEditBonus(playerId) {
    setEditDraft((d) => ({
      ...d,
      [playerId]: { ...d[playerId], bonus: 0, bonusDetail: {} },
    }));
  }

  function editRound(rn) {
    const r = rounds.find((r) => r.roundNumber === rn);
    if (!r) return;
    const d = {};
    players.forEach((p) => {
      const e = r.entries[p.id] || { bid: 0, tricks: 0, bonus: 0 };
      d[p.id] = { bid: e.bid, tricks: e.tricks, bonus: e.bonus, bonusDetail: {} };
    });
    setEditDraft(d);
    setEditingRound(rn);
    setPhaseBeforeEdit(phase);
    setShowHistory(false);
    setPhase("editing");
  }

  function submitEdit() {
    const entries = {};
    players.forEach((p) => {
      const dr = editDraft[p.id] || { bid: 0, tricks: 0, bonus: 0 };
      entries[p.id] = {
        bid: dr.bid,
        tricks: dr.tricks,
        bonus: dr.bonus,
        score: computeRoundScore(editingRound, dr.bid, dr.tricks, dr.bonus),
      };
    });

    setRounds((rs) =>
      rs.map((r) => (r.roundNumber === editingRound ? { roundNumber: editingRound, entries } : r))
    );
    setEditingRound(null);
    setEditDraft({});
    setShowHistory(true);
    setPhase(phaseBeforeEdit);
  }

  function cancelEdit() {
    setEditingRound(null);
    setEditDraft({});
    setShowHistory(true);
    setPhase(phaseBeforeEdit);
  }

  function newGame() {
    setPlayers([{ id: uid(), name: "", photo: null }, { id: uid(), name: "", photo: null }]);
    setRounds([]);
    setRoundNum(1);
    setDraft({});
    setEditingRound(null);
    setEditDraft({});
    setShowHistory(false);
    setPhase("setup");
  }

  // ---- shared styles --------------------------------------------------------
  const styles = {
    page: {
      minHeight: "100vh",
      background: `
        radial-gradient(900px 500px at 50% -8%, ${PALETTE.bgPurpleSoft} 0%, ${PALETTE.bgPurple} 45%, ${PALETTE.bgDeep} 85%)
      `,
      color: PALETTE.cream,
      fontFamily: "'EB Garamond', Georgia, serif",
      padding: "22px 14px 60px",
      boxSizing: "border-box",
    },
    title: {
      fontFamily: "'Pirata One', 'Playfair Display', serif",
      fontWeight: 400,
      letterSpacing: "0.04em",
      color: PALETTE.goldBright,
      textAlign: "center",
      margin: "4px 0 0",
      fontSize: "38px",
      textShadow: `0 0 14px rgba(201,162,75,0.35), 0 2px 0 rgba(0,0,0,0.6)`,
    },
    subtitle: {
      textAlign: "center",
      color: PALETTE.creamDim,
      fontSize: "12px",
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      marginBottom: "20px",
      fontFamily: "'EB Garamond', Georgia, serif",
    },
    card: {
      background: `linear-gradient(160deg, ${PALETTE.parchment} 0%, ${PALETTE.parchmentDark} 100%)`,
      border: `1px solid ${PALETTE.ink}`,
      boxShadow: `inset 0 0 0 3px rgba(58,42,22,0.12), inset 0 0 22px rgba(120,90,40,0.18), 0 6px 14px rgba(0,0,0,0.35)`,
      borderRadius: "8px",
      padding: "17px",
      marginBottom: "13px",
      color: PALETTE.ink,
    },
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Playfair+Display:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }

        .sk-divider {
          width: 140px; height: 10px; margin: 6px auto 18px; opacity: 0.85;
          background: radial-gradient(circle, ${PALETTE.gold} 0%, ${PALETTE.gold} 22%, transparent 26%) repeat-x;
          background-size: 14px 10px;
        }

        .sk-btn {
          border: none; border-radius: 7px; padding: 10px 14px;
          font-weight: 600; font-size: 14px; font-family: 'EB Garamond', Georgia, serif;
          transition: transform 0.08s ease, filter 0.15s ease; letter-spacing: 0.02em;
        }
        .sk-btn:active { transform: scale(0.96); }

        .sk-btn-primary {
          background: linear-gradient(160deg, ${PALETTE.goldBright} 0%, ${PALETTE.gold} 55%, ${PALETTE.goldDark} 100%);
          color: #2a1d0c; font-weight: 700; font-size: 16px;
          border: 1px solid ${PALETTE.goldDark};
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 8px rgba(0,0,0,0.4);
          text-shadow: 0 1px 0 rgba(255,255,255,0.25);
        }
        .sk-btn-primary:active { filter: brightness(0.94); }

        .sk-btn-ghost {
          background: transparent; border: 1px solid rgba(237,227,205,0.35);
          color: ${PALETTE.creamDim};
        }
        .sk-btn-ghost:active { background: rgba(237,227,205,0.08); }

        .sk-btn-parchment-ghost {
          background: rgba(58,42,22,0.06); border: 1px solid ${PALETTE.inkDim};
          color: ${PALETTE.ink};
        }
        .sk-btn-parchment-ghost:active { background: rgba(58,42,22,0.15); }

        .sk-step-btn {
          width: 38px; height: 38px; border-radius: 7px; border: 1px solid ${PALETTE.inkDim};
          background: rgba(58,42,22,0.06); color: ${PALETTE.ink}; font-size: 19px; font-weight: 700;
        }
        .sk-step-btn:active { background: ${PALETTE.gold}; color: #2a1d0c; }

        .sk-chip {
          border: 1px solid ${PALETTE.goldDark}; background: rgba(201,162,75,0.14);
          color: ${PALETTE.ink}; border-radius: 20px; padding: 7px 11px; font-size: 12.5px;
          font-weight: 600; display: flex; align-items: center; gap: 6px; font-family: 'EB Garamond', Georgia, serif;
        }
        .sk-chip:active { background: rgba(201,162,75,0.35); }
        .sk-chip .sk-chip-pts { color: ${PALETTE.goldDark}; font-weight: 700; }

        .sk-input {
          background: rgba(58,42,22,0.05); border: 1px solid ${PALETTE.inkDim}; color: ${PALETTE.ink};
          border-radius: 6px; padding: 9px 10px; font-size: 16px; width: 100%;
          font-family: 'EB Garamond', Georgia, serif;
        }
        .sk-input::placeholder { color: ${PALETTE.inkDim}; opacity: 0.7; }

        .sk-ribbon {
          position: absolute; top: -2px; right: 18px; background: ${PALETTE.crimson};
          color: ${PALETTE.parchment}; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
          padding: 5px 8px 8px; border-radius: 0 0 4px 4px; box-shadow: 0 3px 6px rgba(0,0,0,0.35);
          font-weight: 700;
        }

        .sk-avatar {
          width: 52px; height: 52px; border-radius: 50%; border: 2px solid ${PALETTE.goldDark};
          background: rgba(58,42,22,0.08); display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0; font-size: 22px; color: ${PALETTE.inkDim};
        }
        .sk-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .sk-podium-wrap { display: flex; align-items: flex-end; justify-content: center; gap: 10px; margin: 6px 0 4px; }
        .sk-podium-col { display: flex; flex-direction: column; align-items: center; flex: 1; max-width: 120px; }
        .sk-podium-photo {
          border-radius: 50%; overflow: hidden; background: rgba(58,42,22,0.1);
          display: flex; align-items: center; justify-content: center; margin-bottom: 8px;
        }
        .sk-podium-photo img { width: 100%; height: 100%; object-fit: cover; }
        .sk-podium-block {
          width: 100%; border-radius: 8px 8px 0 0; display: flex; flex-direction: column;
          align-items: center; justify-content: flex-start; padding-top: 8px;
          border: 1px solid ${PALETTE.goldDark}; border-bottom: none;
          box-shadow: inset 0 0 12px rgba(120,90,40,0.25);
        }

        table.sk-table { width: 100%; border-collapse: collapse; font-size: 12.5px; font-family: 'EB Garamond', Georgia, serif; }
        table.sk-table th, table.sk-table td { padding: 7px 6px; text-align: center; }
        table.sk-table th { color: ${PALETTE.inkDim}; font-weight: 700; letter-spacing: 0.03em; border-bottom: 2px solid ${PALETTE.inkDim}; text-transform: uppercase; font-size: 10.5px; }
        table.sk-table td { border-bottom: 1px solid rgba(110,90,60,0.3); color: ${PALETTE.ink}; }
        table.sk-table tr:last-child td { border-bottom: none; }
      `}</style>

      <div style={styles.title}>☠ Skull King</div>
      <div style={styles.subtitle}>
        {phase === "setup" && "Nouvelle partie"}
        {phase === "playing" && `Manche ${roundNum} sur ${TOTAL_ROUNDS}`}
        {phase === "editing" && `Modification de la manche ${editingRound}`}
        {phase === "finished" && "Partie terminée"}
      </div>
      <div className="sk-divider" />

      {phase === "setup" && (
        <SetupScreen
          players={players}
          addPlayer={addPlayer}
          removePlayer={removePlayer}
          renamePlayer={renamePlayer}
          setPlayerPhoto={setPlayerPhoto}
          startGame={startGame}
          styles={styles}
        />
      )}

      {phase === "playing" && (
        <>
          {players.map((p) => (
            <PlayerRoundCard
              key={p.id}
              player={p}
              roundNum={roundNum}
              draft={draft[p.id] || { bid: 0, tricks: 0, bonus: 0, bonusDetail: {} }}
              setField={setField}
              addBonus={addBonus}
              resetBonus={resetBonus}
              expanded={expandedBonus === p.id}
              toggleExpand={() =>
                setExpandedBonus(expandedBonus === p.id ? null : p.id)
              }
              styles={styles}
              runningTotal={totals[p.id] ?? 0}
            />
          ))}

          <button className="sk-btn sk-btn-primary" style={{ width: "100%", padding: "14px", marginTop: "6px" }} onClick={submitRound}>
            {roundNum >= TOTAL_ROUNDS
              ? "Valider la dernière manche ⚓"
              : `Valider la manche ${roundNum} →`}
          </button>

          {rounds.length > 0 && (
            <button
              className="sk-btn sk-btn-ghost"
              style={{ width: "100%", padding: "10px", marginTop: "10px" }}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Masquer l'historique" : "Voir l'historique des manches"}
            </button>
          )}

          {showHistory && (
            <HistoryTable rounds={rounds} players={players} totals={totals} editRound={editRound} styles={styles} />
          )}
        </>
      )}

      {phase === "editing" && (
        <>
          <div
            style={{
              ...styles.card,
              borderColor: PALETTE.goldDark,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
            }}
          >
            <span style={{ fontSize: "13.5px", color: PALETTE.crimson, fontWeight: 700 }}>
              ✎ Modification de la manche {editingRound}
            </span>
            <button className="sk-btn sk-btn-parchment-ghost" style={{ padding: "5px 10px", fontSize: "12.5px" }} onClick={cancelEdit}>
              Annuler
            </button>
          </div>

          {players.map((p) => (
            <PlayerRoundCard
              key={p.id}
              player={p}
              roundNum={editingRound}
              draft={editDraft[p.id] || { bid: 0, tricks: 0, bonus: 0, bonusDetail: {} }}
              setField={setEditField}
              addBonus={addEditBonus}
              resetBonus={resetEditBonus}
              expanded={expandedBonus === p.id}
              toggleExpand={() =>
                setExpandedBonus(expandedBonus === p.id ? null : p.id)
              }
              styles={styles}
              runningTotal={totals[p.id] ?? 0}
            />
          ))}

          <button className="sk-btn sk-btn-primary" style={{ width: "100%", padding: "14px", marginTop: "6px" }} onClick={submitEdit}>
            Enregistrer la modification
          </button>
        </>
      )}

      {phase === "finished" && (
        <FinishedScreen
          ranking={ranking}
          rounds={rounds}
          players={players}
          totals={totals}
          editRound={editRound}
          newGame={newGame}
          styles={styles}
        />
      )}
    </div>
  );
}

// ---- Setup screen -----------------------------------------------------------
function SetupScreen({ players, addPlayer, removePlayer, renamePlayer, setPlayerPhoto, startGame, styles }) {
  function handlePhotoChange(e, playerId) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPlayerPhoto(playerId, reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div>
      <div style={styles.card}>
        <div style={{ fontSize: "12px", color: PALETTE.inkDim, marginBottom: "12px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
          🏴‍☠️ Équipage ({players.length}/8)
        </div>
        {players.map((p, i) => (
          <div key={p.id} style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
            <label className="sk-avatar" style={{ cursor: "pointer" }}>
              {p.photo ? <img src={p.photo} alt={p.name || "joueur"} /> : "☠"}
              <input
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: "none" }}
                onChange={(e) => handlePhotoChange(e, p.id)}
              />
            </label>
            <input
              className="sk-input"
              placeholder={`Joueur ${i + 1}`}
              value={p.name}
              onChange={(e) => renamePlayer(p.id, e.target.value)}
            />
            {players.length > 2 && (
              <button
                className="sk-btn"
                style={{ background: "rgba(122,32,32,0.12)", border: `1px solid ${PALETTE.crimson}`, color: PALETTE.crimson, padding: "8px 12px" }}
                onClick={() => removePlayer(p.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div style={{ fontSize: "10.5px", color: PALETTE.inkDim, fontStyle: "italic", marginBottom: "10px" }}>
          Touchez ☠ pour prendre en photo un membre de l'équipage.
        </div>
        {players.length < 8 && (
          <button
            className="sk-btn sk-btn-parchment-ghost"
            style={{ width: "100%", padding: "10px", marginTop: "4px", borderStyle: "dashed" }}
            onClick={addPlayer}
          >
            + Ajouter un joueur
          </button>
        )}
      </div>

      <button className="sk-btn sk-btn-primary" style={{ width: "100%", padding: "15px", fontSize: "17px" }} onClick={startGame}>
        Hisser les voiles ⚓
      </button>
    </div>
  );
}

// ---- Player round entry card -------------------------------------------------
function PlayerRoundCard({
  player,
  roundNum,
  draft,
  setField,
  addBonus,
  resetBonus,
  expanded,
  toggleExpand,
  styles,
  runningTotal,
}) {
  const preview = computeRoundScore(roundNum, draft.bid, draft.tricks, draft.bonus);
  const success = draft.bid === draft.tricks;

  return (
    <div style={{ ...styles.card, position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "13px" }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "18px", color: PALETTE.ink }}>
          {player.name}
        </span>
        <span style={{ fontSize: "11.5px", color: PALETTE.inkDim, fontStyle: "italic" }}>Total : {runningTotal}</span>
      </div>

      <div style={{ display: "flex", gap: "14px", marginBottom: "11px" }}>
        <Stepper
          label="Annonce"
          value={draft.bid}
          max={roundNum}
          onChange={(v) => setField(player.id, "bid", v)}
        />
        <Stepper
          label="Plis remportés"
          value={draft.tricks}
          max={roundNum}
          onChange={(v) => setField(player.id, "tricks", v)}
        />
      </div>

      <button
        className="sk-btn sk-btn-parchment-ghost"
        onClick={toggleExpand}
        style={{
          width: "100%",
          padding: "8px",
          fontSize: "12.5px",
          color: draft.bonus > 0 ? PALETTE.goldDark : PALETTE.inkDim,
          fontWeight: draft.bonus > 0 ? 700 : 600,
          marginBottom: expanded ? "10px" : "0",
        }}
      >
        Bonus : +{draft.bonus} {expanded ? "▲" : "▼"}
      </button>

      {expanded && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginBottom: "8px" }}>
            {BONUS_CHIPS.map((c) => (
              <button
                key={c.key}
                className="sk-chip"
                onClick={() => addBonus(player.id, c.key, c.points)}
              >
                {c.label} <span className="sk-chip-pts">{c.short}</span>
                {draft.bonusDetail?.[c.key] ? (
                  <span style={{ opacity: 0.75 }}>×{draft.bonusDetail[c.key]}</span>
                ) : null}
              </button>
            ))}
          </div>
          {draft.bonus > 0 && (
            <button
              className="sk-btn"
              style={{ background: "transparent", color: PALETTE.crimson, fontSize: "11.5px", padding: "4px 0" }}
              onClick={() => resetBonus(player.id)}
            >
              Réinitialiser les bonus
            </button>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: "11px",
          paddingTop: "11px",
          borderTop: `1px dashed ${PALETTE.inkDim}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "12px", color: PALETTE.inkDim, fontStyle: "italic" }}>
          {success ? "Annonce réussie" : "Annonce manquée"}
        </span>
        <span
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: "21px",
            color: preview >= 0 ? PALETTE.green : PALETTE.crimson,
          }}
        >
          {preview >= 0 ? "+" : ""}
          {preview}
        </span>
      </div>
    </div>
  );
}

function Stepper({ label, value, max, onChange }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: "10.5px", color: PALETTE.inkDim, marginBottom: "6px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button className="sk-step-btn" onClick={() => onChange(value - 1)}>
          −
        </button>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: "19px",
            fontWeight: 700,
            color: PALETTE.ink,
            fontFamily: "'Playfair Display', serif",
          }}
        >
          {value}
        </div>
        <button className="sk-step-btn" onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
      <div style={{ fontSize: "10px", color: PALETTE.inkDim, textAlign: "center", marginTop: "3px", fontStyle: "italic" }}>
        max {max}
      </div>
    </div>
  );
}

// ---- History table ------------------------------------------------------------
function HistoryTable({ rounds, players, totals, editRound, styles }) {
  return (
    <div style={{ ...styles.card, overflowX: "auto" }}>
      <div style={{ fontSize: "11.5px", color: PALETTE.inkDim, marginBottom: "10px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
        📜 Journal de bord
      </div>
      <table className="sk-table">
        <thead>
          <tr>
            <th>Manche</th>
            {players.map((p) => (
              <th key={p.id}>{p.name}</th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.roundNumber}>
              <td style={{ color: PALETTE.goldDark, fontWeight: 700 }}>{r.roundNumber}</td>
              {players.map((p) => {
                const e = r.entries[p.id];
                return (
                  <td key={p.id} style={{ color: e && e.score >= 0 ? PALETTE.green : PALETTE.crimson, fontWeight: 600 }}>
                    {e ? (e.score >= 0 ? "+" : "") + e.score : "–"}
                  </td>
                );
              })}
              <td>
                <button
                  className="sk-btn"
                  style={{ background: "transparent", color: PALETTE.inkDim, padding: "2px 6px", fontSize: "12px" }}
                  onClick={() => editRound(r.roundNumber)}
                >
                  ✎
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ color: PALETTE.goldDark, fontWeight: 700 }}>Total</td>
            {players.map((p) => (
              <td key={p.id} style={{ fontWeight: 700, color: PALETTE.ink }}>
                {totals[p.id] ?? 0}
              </td>
            ))}
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---- Podium ------------------------------------------------------------
function Podium({ ranking }) {
  const top = ranking.slice(0, 3);
  if (top.length === 0) return null;

  const rankMeta = [
    { height: 128, photoSize: 84, blockBg: `linear-gradient(160deg, ${PALETTE.goldBright}, ${PALETTE.gold})`, medal: "🥇" },
    { height: 96, photoSize: 68, blockBg: `linear-gradient(160deg, #d9d9d9, #a8a8a8)`, medal: "🥈" },
    { height: 72, photoSize: 60, blockBg: `linear-gradient(160deg, #cf9a6a, #a9704a)`, medal: "🥉" },
  ];

  // ordre d'affichage gauche → droite : 2e, 1er, 3e
  const displayOrder = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];

  return (
    <div className="sk-podium-wrap">
      {displayOrder.map((idx) => {
        const p = top[idx];
        const meta = rankMeta[idx];
        return (
          <div className="sk-podium-col" key={p.id}>
            <div
              className="sk-podium-photo"
              style={{ width: meta.photoSize, height: meta.photoSize, border: `3px solid ${PALETTE.goldDark}` }}
            >
              {p.photo ? (
                <img src={p.photo} alt={p.name} />
              ) : (
                <span style={{ fontSize: meta.photoSize * 0.4 }}>☠</span>
              )}
            </div>
            <div style={{ fontSize: "13px", marginBottom: "2px" }}>{meta.medal}</div>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700,
                fontSize: "13px",
                color: PALETTE.cream,
                textAlign: "center",
                marginBottom: "4px",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.name}
            </div>
            <div className="sk-podium-block" style={{ height: meta.height, background: meta.blockBg }}>
              <span style={{ fontFamily: "'Pirata One', serif", fontSize: "20px", color: "#2a1d0c" }}>{idx + 1}</span>
              <span style={{ fontSize: "11px", color: "#2a1d0c", fontWeight: 700, marginTop: "2px" }}>{p.total} pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Finished screen ------------------------------------------------------------
function FinishedScreen({ ranking, rounds, players, totals, editRound, newGame, styles }) {
  return (
    <div>
      <Podium ranking={ranking} />

      <div style={styles.card}>
        {ranking.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "9px 0",
              gap: "10px",
              borderBottom: i < ranking.length - 1 ? `1px dashed ${PALETTE.inkDim}` : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <div className="sk-avatar" style={{ width: "34px", height: "34px", fontSize: "15px" }}>
                {p.photo ? <img src={p.photo} alt={p.name} /> : "☠"}
              </div>
              <span
                style={{
                  color: i === 0 ? PALETTE.goldDark : PALETTE.ink,
                  fontWeight: i === 0 ? 700 : 500,
                  fontFamily: "'Playfair Display', serif",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {i + 1}. {p.name}
              </span>
            </div>
            <span style={{ color: i === 0 ? PALETTE.goldDark : PALETTE.inkDim, fontWeight: 700, flexShrink: 0 }}>{p.total}</span>
          </div>
        ))}
      </div>

      <HistoryTable rounds={rounds} players={players} totals={totals} editRound={editRound} styles={styles} />

      <button className="sk-btn sk-btn-primary" style={{ width: "100%", padding: "14px", marginTop: "6px" }} onClick={newGame}>
        Nouvelle partie
      </button>
    </div>
  );
}
