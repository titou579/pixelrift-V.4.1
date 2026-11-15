// Décors destructibles (v6) — table partagée par le client et le serveur.
//  explosive : explose quand on le détruit (dégâts de zone, réaction en chaîne)
//  breakable : se brise (redonne un peu de vie à celui qui le casse)
//  hp        : nombre de tirs nécessaires ; respawn : délai avant réapparition (s)
export const DESTRUCTIBLES = {
  tn_barrel:  { type: 'explosive', hp: 2, radius: 7, dmg: 80 },
  tn_gastank: { type: 'explosive', hp: 2, radius: 8, dmg: 100 },
  car_sedan:  { type: 'explosive', hp: 9, radius: 8, dmg: 90 },
  car_hatch:  { type: 'explosive', hp: 9, radius: 8, dmg: 90 },
  car_police: { type: 'explosive', hp: 9, radius: 8, dmg: 90 },
  car_suv:    { type: 'explosive', hp: 10, radius: 8, dmg: 90 },
  car_sports: { type: 'explosive', hp: 9, radius: 8, dmg: 90 },
  car_sports2:{ type: 'explosive', hp: 9, radius: 8, dmg: 90 },
  car_taxi:   { type: 'explosive', hp: 9, radius: 8, dmg: 90 },
  sv_barrel:  { type: 'breakable', hp: 3 },
  tn_crate:   { type: 'breakable', hp: 3 },
  wh_box:     { type: 'breakable', hp: 3 },
  sv_box:     { type: 'breakable', hp: 3 },
  tn_boxes:   { type: 'breakable', hp: 2 },
  mailbox:    { type: 'breakable', hp: 2 },
  flowerpot:  { type: 'breakable', hp: 1 },
  planter:    { type: 'breakable', hp: 3 },
};
export const PROP_RESPAWN_S = 120;
