import { useState } from 'react';

// ============================================================
// TUTORIEL (v6) — PC et mobile. S'ouvre tout seul à la première partie, puis depuis
// le salon et le menu pause (« Tutoriel »).
// ============================================================
export const TUTO_KEY = 'pixelrift.tutoDone.v1';
export const tutoSeen = () => { try { return localStorage.getItem(TUTO_KEY) === '1'; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(TUTO_KEY, '1'); } catch { /* ignore */ } };

const K = ({ children }) => <span className="kbd">{children}</span>;

const PC = [
  { title: 'Bienvenue sur PIXELRIFT', body: (<>
    <p>Un FPS multijoueur en 3D : élimine tes adversaires (joueurs ou bots) avant qu'ils ne t'éliminent.</p>
    <p>Tu démarres <b>avec un simple pistolet</b>. Toutes les autres armes se trouvent dans les <b>coffres dorés</b> répartis sur la carte. Plus tu es rapide, mieux tu es équipé.</p>
    <p className="tuto-tip">Choisis le mode et la carte dans le salon : Mêlée générale, Équipes, Course aux armes, Roi de la colline.</p></>) },
  { title: 'Se déplacer', body: (<>
    <div className="tuto-keys"><K>Z</K><K>Q</K><K>S</K><K>D</K> <span>marcher</span></div>
    <div className="tuto-keys"><K>Maj</K> <span>courir</span> <K>Espace</K> <span>sauter</span></div>
    <div className="tuto-keys"><K>C</K> <span>glisser (en courant) : rapide et baisse la caméra</span></div>
    <div className="tuto-keys"><K>E</K> <span>Rift : te téléporte là où tu vises</span></div>
    <p className="tuto-tip">Les zones bleues lumineuses au sol activent la gravité lunaire : sauts hauts et longs.</p></>) },
  { title: 'Tirer et viser', body: (<>
    <div className="tuto-keys"><K>Clic gauche</K> <span>tirer</span></div>
    <div className="tuto-keys"><K>Clic droit</K> <span>viser (zoom, plus précis)</span></div>
    <div className="tuto-keys"><K>R</K> <span>recharger</span> <K>1-5</K>/<K>molette</K> <span>changer d'arme</span></div>
    <p>La tête fait plus de dégâts. La vie se régénère toute seule après quelques secondes sans combat.</p></>) },
  { title: 'Coffres et armes', body: (<>
    <p>Approche-toi d'un <b>coffre doré</b> (un faisceau lumineux le signale de loin) et appuie sur <K>F</K>.</p>
    <p>Chaque coffre donne une arme et un peu de vie. Quatre raretés : <b style={{ color: '#b6bcc4' }}>commun</b>, <b style={{ color: '#4fa8ff' }}>rare</b>, <b style={{ color: '#b866ff' }}>épique</b>, <b style={{ color: '#ffb62e' }}>légendaire</b>.</p>
    <p>Tu as <b>5 emplacements</b>. Quand ils sont pleins, la nouvelle arme remplace celle que tu tiens. <b>Tu perds ton équipement quand tu meurs.</b> Les coffres réapparaissent au bout d'un moment.</p></>) },
  { title: 'Inventaire et carte (Tab)', body: (<>
    <p>Maintiens <K>Tab</K> : tu vois ton <b>équipement</b> (icônes, dégâts, cadence), la <b>carte du monde</b> avec ta position, les coffres encore fermés et la zone du mode en cours, plus le classement.</p>
    <p>Une <b>mini-carte</b> est aussi affichée en haut à gauche pendant la partie.</p></>) },
  { title: 'Décors interactifs', body: (<>
    <p>Tire sur les décors :</p>
    <ul>
      <li><b>Tonneaux, bonbonnes et voitures</b> : ils explosent et blessent tout autour (réaction en chaîne !). Attention à ne pas être trop près.</li>
      <li><b>Caisses, boîtes, pots, boîtes aux lettres</b> : ils se brisent. Casser une caisse te redonne un peu de vie.</li>
    </ul>
    <p>Ils réapparaissent après quelques minutes. Les tentes sont traversables et on passe entre les troncs d'arbres.</p></>) },
  { title: 'Chat vocal', body: (<>
    <p>Ton <b>micro est ouvert en permanence</b>. Tu entends les autres joueurs de plus en plus fort quand ils sont proches.</p>
    <div className="tuto-keys"><K>M</K> <span>couper / rétablir le micro</span></div>
    <p className="tuto-tip">Tu préfères le « appuyer pour parler » ? Menu pause → Micro, puis maintiens <K>V</K>.</p></>) },
];

const MOBILE = [
  { title: 'Bienvenue sur PIXELRIFT', body: (<>
    <p>Joue en <b>mode paysage</b>. Élimine tes adversaires (joueurs ou bots).</p>
    <p>Tu démarres avec un pistolet : les autres armes sont dans les <b>coffres dorés</b> de la carte.</p></>) },
  { title: 'Se déplacer et regarder', body: (<>
    <p>🕹️ <b>Joystick à gauche</b> : marcher. Pousse-le à fond pour <b>courir</b>.</p>
    <p>👆 <b>Fais glisser ton doigt</b> n'importe où ailleurs sur l'écran pour regarder autour de toi.</p>
    <p className="tuto-tip">Pendant que tu tires, tu peux aussi glisser le doigt depuis le bouton TIR pour viser.</p></>) },
  { title: 'Les boutons', body: (<>
    <ul>
      <li><b>TIR</b> : tire (maintiens pour les armes automatiques)</li>
      <li><b>VISER</b> : zoom et précision</li>
      <li><b>SAUT</b>, <b>GLISSE</b> (en courant), <b>RECH.</b> (recharger)</li>
      <li><b>RIFT</b> : téléportation là où tu vises</li>
      <li><b>OUVRIR</b> : apparaît près d'un coffre</li>
      <li><b>CARTE</b> : équipement + carte + classement</li>
      <li><b>MICRO</b> : couper le micro (ouvert par défaut) · <b>II</b> : pause</li>
    </ul></>) },
  { title: 'Coffres et inventaire', body: (<>
    <p>Approche d'un coffre doré et touche <b>OUVRIR</b>. Tu obtiens une arme (4 raretés) et un peu de vie.</p>
    <p>La barre d'inventaire en bas a <b>5 emplacements</b> : touche une icône pour changer d'arme. Tu perds tout si tu meurs.</p></>) },
  { title: 'Décors interactifs', body: (<>
    <p>Tire sur les <b>tonneaux, bonbonnes et voitures</b> : ils explosent et blessent autour. Les <b>caisses</b> se brisent et te redonnent un peu de vie.</p></>) },
  { title: 'Personnaliser les touches', body: (<>
    <p>Les boutons s'adaptent automatiquement à la taille de ton écran. Pour les déplacer :</p>
    <p><b>II</b> (pause) → <b>Personnaliser les touches</b> : glisse chaque bouton à ta place, règle la taille et la transparence, puis <b>Terminé</b>. Tout est enregistré sur ton appareil.</p>
    <p className="tuto-tip">Astuce : active le plein écran depuis le menu pause pour plus de place.</p></>) },
];

export default function Tutorial({ onClose, defaultMobile = false }) {
  const [mobile, setMobile] = useState(defaultMobile);
  const [i, setI] = useState(0);
  const steps = mobile ? MOBILE : PC;
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  const close = () => { markSeen(); onClose(); };
  const switchTo = (m) => { setMobile(m); setI(0); };

  return (
    <div className="full-overlay tuto-overlay" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="tuto-box">
        <div className="tuto-head">
          <span className="tuto-tag">// TUTORIEL</span>
          <div className="tuto-switch">
            <button className={!mobile ? 'on' : ''} onClick={() => switchTo(false)}>🖥️ PC</button>
            <button className={mobile ? 'on' : ''} onClick={() => switchTo(true)}>📱 Mobile</button>
          </div>
        </div>
        <h2>{step.title}</h2>
        <div className="tuto-body">{step.body}</div>
        <div className="tuto-dots">{steps.map((_, k) => <i key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div>
        <div className="tuto-foot">
          <button className="ghost" onClick={close}>Passer</button>
          <div>
            {i > 0 && <button onClick={() => setI(i - 1)}>← Précédent</button>}
            {!last ? <button className="primary" onClick={() => setI(i + 1)}>Suivant →</button> : <button className="primary" onClick={close}>C'est parti !</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
