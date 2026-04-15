'use strict';
/**
 * _build_wc_editions.js
 * Generates public/_wc_editions.js — all WC editions 1930-2026 mapped to engine slugs+eras.
 * Run: node _build_wc_editions.js
 */

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// 1. NAME → SLUG+BADGE MAPPING
// ─────────────────────────────────────────────────────────────────────────────
const TEAM_MAP = {
  'Alemania':            { slug: 'deutschland',           badge: 'deutschland.png'    },
  'Alemania Federal':    { slug: 'deutschland',           badge: 'deutschland.png'    },
  'RFA':                 { slug: 'deutschland',           badge: 'deutschland.png'    },
  'Alemania RFA':        { slug: 'deutschland',           badge: 'deutschland.png'    },
  'RDA':                 { slug: 'ddr',                   badge: 'ddr.png'            },
  'Argelia':             { slug: 'algerien',              badge: 'algerien.png'       },
  'Argentina':           { slug: 'argentinien',           badge: 'argentinien.png'    },
  'Arabia Saudí':        { slug: 'saudi-arabien',         badge: 'saudi-arabia.png'   },
  'Australia':           { slug: 'australien',            badge: 'australia.png'      },
  'Austria':             { slug: 'osterreich',            badge: 'osterreich.png'     },
  'Bélgica':             { slug: 'belgien',               badge: 'belgien.png'        },
  'Bolivia':             { slug: 'bolivien',              badge: 'bolivien.png'       },
  'Bosnia':              { slug: 'bosnien-herzegowina',   badge: 'bosnia.png'         },
  'Brasil':              { slug: 'brasilien',             badge: 'brasilien.png'      },
  'Bulgaria':            { slug: 'bulgarien',             badge: 'bulgaria.png'       },
  'Camerún':             { slug: 'kamerun',               badge: 'cameroon.png'       },
  'Canadá':              { slug: 'kanada',                badge: 'canada.png'         },
  'Catar':               { slug: 'katar',                 badge: 'katar.png'          },
  'Chile':               { slug: 'chile',                 badge: 'chile.png'          },
  'China':               { slug: 'china',                 badge: 'china.png'          },
  'Colombia':            { slug: 'kolumbien',             badge: 'colombia.png'       },
  'Corea del Norte':     { slug: 'nordkorea',             badge: 'north-korea.png'    },
  'Corea del Sur':       { slug: 'sudkorea',              badge: 'south-korea.png'    },
  'Costa de Marfil':     { slug: 'elfenbeinkuste',        badge: 'ivory-coast.png'    },
  'Costa Rica':          { slug: 'costa-rica',            badge: 'costa-rica.png'     },
  'Croacia':             { slug: 'kroatien',              badge: 'kroatien.png'       },
  'Cuba':                { slug: 'cuba',                  badge: 'cuba.png'           },
  'Checoslovaquia':      { slug: 'tschechien',            badge: 'tschechien.png'     },
  'Dinamarca':           { slug: 'danemark',              badge: 'danemark.png'       },
  'Ecuador':             { slug: 'ecuador',               badge: 'ecuador.png'        },
  'Egipto':              { slug: 'agypten',               badge: 'egypt.png'          },
  'El Salvador':         { slug: 'el-salvador',           badge: 'el-salvador.png'    },
  'Escocia':             { slug: 'schottland',            badge: 'schottland.png'     },
  'Eslovaquia':          { slug: 'slowakei',              badge: 'slovakia.png'       },
  'Eslovenia':           { slug: 'slowenien',             badge: 'slovenia.png'       },
  'España':              { slug: 'spanien',               badge: 'spanien.png'        },
  'EE.UU.':              { slug: 'vereinigte-staaten',    badge: 'united-states.png'  },
  'Estados Unidos':      { slug: 'vereinigte-staaten',    badge: 'united-states.png'  },
  'EAU':                 { slug: 'emirate',               badge: '_placeholder.svg'   },
  'Francia':             { slug: 'frankreich',            badge: 'frankreich.png'     },
  'Gales':               { slug: 'wales',                 badge: 'wales.png'          },
  'Ghana':               { slug: 'ghana',                 badge: 'ghana.png'          },
  'Grecia':              { slug: 'griechenland',          badge: 'greece.png'         },
  'Haití':               { slug: 'haiti',                 badge: 'haiti.png'          },
  'Honduras':            { slug: 'honduras',              badge: 'honduras.png'       },
  'Hungría':             { slug: 'ungarn',                badge: 'hungary.png'        },
  'India':               { slug: 'india',                 badge: '_placeholder.svg'   },
  'Indonesia':           { slug: 'indonesia',             badge: 'indonesia.png'      },
  'Inglaterra':          { slug: 'england',               badge: 'england.png'        },
  'Irán':                { slug: 'iran',                  badge: 'iran.png'           },
  'Irlanda':             { slug: 'ireland',               badge: 'ireland.png'        },
  'Irlanda del Norte':   { slug: 'nordirland',            badge: '_placeholder.svg'   },
  'Islandia':            { slug: 'island',                badge: 'iceland.png'        },
  'Israel':              { slug: 'israel',                badge: 'israel.png'         },
  'Italia':              { slug: 'italien',               badge: 'italien.png'        },
  'Irak':                { slug: 'irak',                  badge: 'iraq.png'           },
  'Jamaica':             { slug: 'jamaika',               badge: 'jamaica.png'        },
  'Japón':               { slug: 'japan',                 badge: 'japan.png'          },
  'Kuwait':              { slug: 'kuwait',                badge: 'kuwait.png'         },
  'Angola':              { slug: 'angola',                badge: 'angola.png'         },
  'Togo':                { slug: 'togo',                  badge: 'togo.png'           },
  'Marruecos':           { slug: 'marokko',               badge: 'morocco.png'        },
  'México':              { slug: 'mexiko',                badge: 'mexico.png'         },
  'Nigeria':             { slug: 'nigeria',               badge: 'nigeria.png'        },
  'Noruega':             { slug: 'norwegen',              badge: 'norway.png'         },
  'Nueva Zelanda':       { slug: 'neuseeland',            badge: 'new-zealand.png'    },
  'Países Bajos':        { slug: 'niederlande',           badge: 'niederlande.png'    },
  'Holanda':             { slug: 'niederlande',           badge: 'niederlande.png'    },
  'Panamá':              { slug: 'panama',                badge: 'panama.png'         },
  'Paraguay':            { slug: 'paraguay',              badge: 'paraguay.png'       },
  'Perú':                { slug: 'peru',                  badge: 'peru.png'           },
  'Polonia':             { slug: 'polen',                 badge: 'poland.png'         },
  'Portugal':            { slug: 'portugal',              badge: 'portugal.png'       },
  'Rep. Checa':          { slug: 'tschechien',            badge: 'tschechien.png'     },
  'República Checa':     { slug: 'tschechien',            badge: 'tschechien.png'     },
  'Rep. Irlanda':        { slug: 'ireland',               badge: 'ireland.png'        },
  'Rumania':             { slug: 'rumania',               badge: 'rumania.png'        },
  'Rusia':               { slug: 'russland',              badge: 'rusia.png'          },
  'Senegal':             { slug: 'senegal',               badge: 'senegal.png'        },
  'Serbia':              { slug: 'serbien',               badge: 'serbia.png'         },
  'Serbia y Montenegro': { slug: 'serbien',               badge: 'serbia.png'         },
  'Sudáfrica':           { slug: 'sudafrika',             badge: 'south-africa.png'   },
  'Suecia':              { slug: 'schweden',              badge: 'schweden.png'       },
  'Suiza':               { slug: 'schweiz',               badge: 'schweiz.png'        },
  'Trinidad y Tobago':   { slug: 'trinidad-und-tobago',   badge: 'trinidad-and-tobago.png' },
  'Turquía':             { slug: 'turkei',                badge: 'turkey.png'         },
  'Túnez':               { slug: 'tunesien',              badge: 'Tunisia.png'        },
  'Ucrania':             { slug: 'ukraine',               badge: 'ukraine.png'        },
  'Uruguay':             { slug: 'uruguay',               badge: 'uruguay.png'        },
  'URSS':                { slug: 'urss',                  badge: 'urss.svg'           },
  'Yugoslavia':          { slug: 'jugoslawien',           badge: '_placeholder.svg'   },
  'Zaire':               { slug: 'kongo',                 badge: 'kongo.svg'          },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. ERA OVERRIDES
// ─────────────────────────────────────────────────────────────────────────────
const ERA_OVERRIDES = {
  'brasilien:1966':'1966','brasilien:1970':'1970','brasilien:1974':'1974',
  'brasilien:1978':'1978','brasilien:1982':'1982','brasilien:1986':'1986',
  'brasilien:1990':'1990','brasilien:1994':'1994','brasilien:1998':'1998',
  'brasilien:2002':'2002','brasilien:2006':'2006','brasilien:2010':'2010',
  'brasilien:2014':'2014','brasilien:2018':'2018','brasilien:2022':'2022',
  'argentinien:1966':'1966','argentinien:1974':'1974','argentinien:1978':'1978',
  'argentinien:1982':'1982','argentinien:1986':'1986','argentinien:1990':'1990',
  'argentinien:1994':'1994','argentinien:1998':'1998','argentinien:2002':'2002',
  'argentinien:2006':'2006','argentinien:2010':'2010','argentinien:2014':'2014',
  'argentinien:2018':'2018','argentinien:2022':'2022',
  'deutschland:1966':'1966','deutschland:1970':'1970','deutschland:1974':'1974',
  'deutschland:1978':'1978','deutschland:1982':'1982','deutschland:1986':'1986',
  'deutschland:1990':'1990','deutschland:1994':'1994','deutschland:1998':'1998',
  'deutschland:2002':'2002','deutschland:2006':'2006','deutschland:2010':'2010',
  'deutschland:2014':'2014','deutschland:2018':'2018','deutschland:2022':'2022',
  'frankreich:1966':'1966','frankreich:1978':'1978','frankreich:1982':'1982',
  'frankreich:1986':'1986','frankreich:1990':'1990','frankreich:1998':'1998',
  'frankreich:2002':'2002','frankreich:2006':'2006','frankreich:2010':'2010',
  'frankreich:2014':'2014','frankreich:2018':'2018','frankreich:2022':'2022',
  'italien:1966':'1966','italien:1970':'1970','italien:1974':'1974',
  'italien:1978':'1978','italien:1982':'1982','italien:1986':'1986',
  'italien:1990':'1990','italien:1994':'1994','italien:1998':'1998',
  'italien:2002':'2002','italien:2006':'2006','italien:2010':'2010',
  'italien:2014':'2014','italien:2018':'2018','italien:2022':'2022',
  'spanien:1966':'1966','spanien:1978':'1978','spanien:1982':'1982',
  'spanien:1986':'1986','spanien:1990':'1990','spanien:1994':'1994',
  'spanien:1998':'1998','spanien:2002':'2002','spanien:2006':'2006',
  'spanien:2010':'2010','spanien:2014':'2014','spanien:2018':'2018',
  'spanien:2022':'2022',
  'niederlande:1966':'1966','niederlande:1974':'1974','niederlande:1978':'1978',
  'niederlande:1982':'1982','niederlande:1986':'1986','niederlande:1990':'1990',
  'niederlande:1994':'1994','niederlande:1998':'1998','niederlande:2002':'2002',
  'niederlande:2006':'2006','niederlande:2010':'2010','niederlande:2014':'2014',
  'niederlande:2018':'2018','niederlande:2022':'2022',
  'portugal:1966':'1966','portugal:1986':'1986','portugal:2002':'2002',
  'portugal:2006':'2006','portugal:2010':'2010','portugal:2014':'2014',
  'portugal:2018':'2018','portugal:2022':'2022',
  'belgien:1966':'1966','belgien:1970':'1970','belgien:1974':'1974',
  'belgien:1978':'1978','belgien:1982':'1982','belgien:1986':'1986',
  'belgien:1990':'1990','belgien:1994':'1994','belgien:1998':'1998',
  'belgien:2002':'2002','belgien:2006':'2006','belgien:2010':'2010',
  'belgien:2014':'2014','belgien:2018':'2018','belgien:2022':'2022',
  'schweiz:1966':'1966','schweiz:1982':'1982','schweiz:1994':'1994',
  'schweiz:1998':'1998','schweiz:2002':'2002','schweiz:2006':'2006',
  'schweiz:2010':'2010','schweiz:2014':'2014','schweiz:2018':'2018',
  'schweiz:2022':'2022',
  'schweden:1966':'1966','schweden:1970':'1970','schweden:1974':'1974',
  'schweden:1978':'1978','schweden:1982':'1982','schweden:1986':'1986',
  'schweden:1990':'1990','schweden:1994':'1994','schweden:1998':'1998',
  'schweden:2002':'2002','schweden:2006':'2006','schweden:2010':'2010',
  'schweden:2014':'2014','schweden:2018':'2018','schweden:2022':'2022',
  'danemark:1986':'1986','danemark:1990':'1990','danemark:1994':'1994',
  'danemark:1998':'1998','danemark:2002':'2002','danemark:2006':'2006',
  'danemark:2010':'2010','danemark:2014':'2014','danemark:2018':'2018',
  'danemark:2022':'2022',
  'osterreich:1966':'1966','osterreich:1970':'1970','osterreich:1974':'1974',
  'osterreich:1978':'1978','osterreich:1982':'1982','osterreich:1986':'1986',
  'osterreich:1990':'1990','osterreich:1994':'1994','osterreich:1998':'1998',
  'osterreich:2002':'2002','osterreich:2006':'2006','osterreich:2010':'2010',
  'osterreich:2014':'2014','osterreich:2018':'2018','osterreich:2022':'2022',
  'polen:1974':'1974','polen:1978':'1978','polen:1982':'1982','polen:1986':'1986',
  'urss:1966':'1966','urss:1970':'1970','urss:1982':'1982','urss:1988':'1988',
  'jugoslawien:1974':'1974','jugoslawien:1982':'1982','jugoslawien:1990':'1990',
  'ddr:1974':'1974',
  'kroatien:1998':'1998','kroatien:2002':'2002','kroatien:2006':'2006',
  'kroatien:2010':'2010','kroatien:2014':'2014','kroatien:2018':'2018',
  'kroatien:2022':'2022',
  'schottland:1966':'1966','schottland:1970':'1970','schottland:1974':'1974',
  'schottland:1978':'1978','schottland:1982':'1982','schottland:1986':'1986',
  'schottland:1990':'1990',
  'tschechien:1994':'1994','tschechien:1998':'1998','tschechien:2002':'2002',
  'tschechien:2006':'2006','tschechien:2010':'2010','tschechien:2014':'2014',
  'tschechien:2018':'2018','tschechien:2022':'2022',
  'kamerun:1990':'1990','ungarn:1954':'1954','marokko:2022':'2022',
  'senegal:2002':'2002','ghana:2010':'2010','sudkorea:2002':'2002',
  'uruguay:1950':'1950','uruguay:2010':'2010','uruguay:2018':'2018',
  'england:1986':'1986','england:2018':'2018',
  'russland:2010':'2010','kuwait:1982':'1982','angola:2006':'2006',
  'togo:2006':'2006','cuba:1938':'1938','indonesia:1938':'1938',
  // Newly added eras (from _fill_wc_seasons.js)
  'algerien:1982':'1982','algerien:1986':'1986','algerien:2010':'2010','algerien:2014':'2014',
  'bulgarien:1966':'1966','bulgarien:1970':'1970','bulgarien:1974':'1974','bulgarien:1998':'1998',
  'chile:1966':'1966','chile:1974':'1974','chile:1982':'1982',
  'england:1966':'1966','england:1970':'1970','england:1982':'1982','england:1990':'1990',
  'iran:1978':'1978','iran:1998':'1998','iran:2006':'2006','iran:2014':'2014','iran:2018':'2018','iran:2022':'2022',
  'japan:1998':'1998','japan:2002':'2002','japan:2006':'2006','japan:2010':'2010','japan:2014':'2014','japan:2018':'2018','japan:2022':'2022',
  'kamerun:1982':'1982','kamerun:1994':'1994','kamerun:1998':'1998','kamerun:2002':'2002','kamerun:2010':'2010',
  'kongo:1974':'1974',
  'marokko:1970':'1970','marokko:1986':'1986','marokko:1994':'1994','marokko:1998':'1998',
  'mexiko:1970':'1970','mexiko:1986':'1986',
  'nigeria:1994':'1994','nigeria:1998':'1998','nigeria:2002':'2002','nigeria:2010':'2010','nigeria:2014':'2014','nigeria:2018':'2018',
  'peru:1970':'1970','peru:1978':'1978','peru:1982':'1982',
  'rumania:1970':'1970','rumania:1990':'1990',
  'saudi-arabien:1994':'1994','saudi-arabien:1998':'1998','saudi-arabien:2002':'2002','saudi-arabien:2006':'2006',
  'senegal:2018':'2018','senegal:2022':'2022',
  'tunesien:1978':'1978','tunesien:1998':'1998','tunesien:2002':'2002','tunesien:2006':'2006','tunesien:2018':'2018','tunesien:2022':'2022',
  'turkei:2002':'2002',
  'ungarn:1966':'1966','ungarn:1970':'1970','ungarn:1978':'1978','ungarn:1982':'1982',
  'vereinigte-staaten:1994':'1994','vereinigte-staaten:1998':'1998','vereinigte-staaten:2002':'2002',
  'vereinigte-staaten:2006':'2006','vereinigte-staaten:2010':'2010','vereinigte-staaten:2014':'2014',
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. RAW EDITION DATA
// ─────────────────────────────────────────────────────────────────────────────
const EDITIONS_RAW = [
  { year:1930, format:'groups_semifinal',  host:'Uruguay',
    normativa:'2 grupos → semis · 13 sel. · 2 pts victoria',
    groups:[['Argentina','Chile','Francia','Mexico','Brasil','Bolivia','Yugoslavia'],['Uruguay','Rumania','Peru','Estados Unidos','Belgica','Paraguay']] },
  { year:1934, format:'knockout16',        host:'Italia',
    normativa:'Eliminación directa completa · prórroga y desempate',
    groups:[['Italia','Estados Unidos','Espana','Brasil'],['Austria','Francia','Hungria','Egipto'],['Alemania Federal','Belgica','Suecia','Argentina'],['Checoslovaquia','Rumania','Suiza','Paises Bajos']] },
  { year:1938, format:'knockout16',        host:'Francia',
    normativa:'Eliminación directa desde octavos · 15 sel.',
    groups:[['Italia','Noruega','Francia','Belgica'],['Brasil','Polonia','Alemania Federal','Suiza'],['Cuba','Rumania','Hungria','Indonesia'],['Checoslovaquia','Paises Bajos','Suecia','Argentina']] },
  { year:1942, format:'cancelled',         host:null,   normativa:'Cancelada — II Guerra Mundial', groups:null },
  { year:1946, format:'cancelled',         host:null,   normativa:'Cancelada — II Guerra Mundial', groups:null },
  { year:1950, format:'groups_final_pool', host:'Brasil',
    normativa:'4 grupos → liguilla final · 4 sel. · sin partido final',
    groups:[['Brasil','Mexico','Yugoslavia','Suiza'],['Espana','Inglaterra','Chile','Estados Unidos'],['Uruguay','Bolivia'],['Suecia','Paraguay','Italia']] },
  { year:1954, format:'groups_of_4_ko',    host:'Suiza',
    normativa:'4 grupos → cuartos · cabezas de grupo no se enfrentan',
    groups:[['Brasil','Yugoslavia','Francia','Mexico'],['Hungria','Alemania Federal','Turquia','Corea del Sur'],['Uruguay','Austria','Checoslovaquia','Escocia'],['Inglaterra','Italia','Belgica','Suiza']] },
  { year:1958, format:'groups_of_4_ko',    host:'Suecia',
    normativa:'4 grupos → cuartos · 16 sel.',
    groups:[['Alemania Federal','Irlanda del Norte','Checoslovaquia','Argentina'],['Francia','Yugoslavia','Paraguay','Escocia'],['Suecia','Hungria','Gales','Mexico'],['Brasil','Austria','Inglaterra','URSS']] },
  { year:1962, format:'groups_of_4_ko',    host:'Chile',
    normativa:'4 grupos → cuartos · 2 pts victoria',
    groups:[['Brasil','Checoslovaquia','Mexico','Espana'],['Chile','Suiza','Alemania Federal','Italia'],['Uruguay','Colombia','Yugoslavia','URSS'],['Hungria','Inglaterra','Bulgaria','Argentina']] },
  { year:1966, format:'groups_of_4_ko',    host:'Inglaterra',
    normativa:'4 grupos → cuartos · 2 pts victoria',
    groups:[['Inglaterra','Uruguay','Mexico','Francia'],['Alemania Federal','Argentina','Espana','Suiza'],['Portugal','Hungria','Bulgaria','Brasil'],['URSS','Corea del Norte','Italia','Chile']] },
  { year:1970, format:'groups_of_4_ko',    host:'Mexico',
    normativa:'4 grupos → semis · tarjetas amarilla/roja',
    groups:[['Brasil','Checoslovaquia','Inglaterra','Rumania'],['Mexico','Belgica','El Salvador','URSS'],['Italia','Suecia','Israel','Uruguay'],['Alemania Federal','Peru','Bulgaria','Marruecos']] },
  { year:1974, format:'groups_of_4_ko',    host:'Alemania Federal',
    normativa:'4 grupos → 2ª fase grupos → final',
    groups:[['Alemania Federal','Australia','Chile','RDA'],['Brasil','Yugoslavia','Escocia','Zaire'],['Paises Bajos','Suecia','Bulgaria','Uruguay'],['Polonia','Haiti','Argentina','Italia']] },
  { year:1978, format:'groups_of_4_ko',    host:'Argentina',
    normativa:'4 grupos → 2ª fase grupos → final',
    groups:[['Argentina','Hungria','Francia','Italia'],['Alemania Federal','Mexico','Tunez','Polonia'],['Brasil','Espana','Suecia','Austria'],['Paises Bajos','Iran','Peru','Escocia']] },
  { year:1982, format:'groups24_ko',       host:'Espana',
    normativa:'6 grupos → octavos · 2º + 4 mejores terceros',
    groups:[['Belgica','Argentina','Hungria','El Salvador'],['Italia','Polonia','Peru','Camerun'],['Brasil','URSS','Escocia','Nueva Zelanda'],['Alemania Federal','Austria','Argelia','Chile'],['Inglaterra','Kuwait','Francia','Checoslovaquia'],['Espana','Honduras','Yugoslavia','Irlanda del Norte']] },
  { year:1986, format:'groups24_ko',       host:'Mexico',
    normativa:'6 grupos → octavos · 2º + 4 mejores terceros',
    groups:[['Francia','Canada','URSS','Hungria'],['Mexico','Belgica','Paraguay','Irak'],['Argentina','Italia','Bulgaria','Corea del Sur'],['Uruguay','Alemania Federal','Dinamarca','Escocia'],['Brasil','Espana','Irlanda del Norte','Argelia'],['Inglaterra','Portugal','Marruecos','Polonia']] },
  { year:1990, format:'groups24_ko',       host:'Italia',
    normativa:'6 grupos → octavos · 2º + 4 mejores terceros',
    groups:[['Italia','Austria','EE.UU.','Checoslovaquia'],['Camerun','Rumania','Argentina','URSS'],['Brasil','Costa Rica','Escocia','Suecia'],['Alemania Federal','Yugoslavia','Colombia','EAU'],['Espana','Belgica','Uruguay','Corea del Sur'],['Inglaterra','Holanda','Egipto','Irlanda']] },
  { year:1994, format:'groups24_ko',       host:'EE.UU.',
    normativa:'6 grupos → octavos · 3 pts victoria (1ª vez)',
    groups:[['Brasil','Suecia','Rusia','Camerun'],['Alemania','Espana','Corea del Sur','Bolivia'],['Italia','Noruega','Mexico','Irlanda'],['Holanda','Arabia Saudi','Belgica','Marruecos'],['Nigeria','Bulgaria','Argentina','Grecia'],['Suiza','EE.UU.','Colombia','Rumania']] },
  { year:1998, format:'groups32_ko',       host:'Francia',
    normativa:'8 grupos → octavos · gol de oro · 32 sel.',
    groups:[['Brasil','Noruega','Marruecos','Escocia'],['Italia','Chile','Camerun','Austria'],['Francia','Dinamarca','Arabia Saudi','Sudafrica'],['Nigeria','Paraguay','Espana','Bulgaria'],['Holanda','Mexico','Belgica','Corea del Sur'],['Alemania','Yugoslavia','Iran','EE.UU.'],['Rumania','Colombia','Inglaterra','Tunez'],['Argentina','Japon','Jamaica','Croacia']] },
  { year:2002, format:'groups32_ko',       host:'Corea del Sur / Japón',
    normativa:'8 grupos → octavos · 1er Mundial en Asia',
    groups:[['Francia','Senegal','Uruguay','Dinamarca'],['Espana','Paraguay','Sudafrica','Eslovenia'],['Brasil','Turquia','China','Costa Rica'],['Corea del Sur','EE.UU.','Portugal','Polonia'],['Alemania','Arabia Saudi','Irlanda','Camerun'],['Argentina','Nigeria','Inglaterra','Suecia'],['Italia','Ecuador','Croacia','Mexico'],['Japon','Rusia','Tunez','Belgica']] },
  { year:2006, format:'groups32_ko',       host:'Alemania',
    normativa:'8 grupos → octavos · 32 sel.',
    groups:[['Alemania','Costa Rica','Polonia','Ecuador'],['Inglaterra','Paraguay','Trinidad y Tobago','Suecia'],['Argentina','Costa de Marfil','Serbia y Montenegro','Holanda'],['Mexico','Iran','Angola','Portugal'],['Italia','Ghana','EE.UU.','Republica Checa'],['Brasil','Croacia','Japon','Australia'],['Francia','Suiza','Corea del Sur','Togo'],['Espana','Ucrania','Tunez','Arabia Saudi']] },
  { year:2010, format:'groups32_ko',       host:'Sudáfrica',
    normativa:'8 grupos → octavos · 1er Mundial en África',
    groups:[['Sudafrica','Mexico','Uruguay','Francia'],['Argentina','Nigeria','Corea del Sur','Grecia'],['Inglaterra','EE.UU.','Argelia','Eslovenia'],['Alemania','Australia','Serbia','Ghana'],['Holanda','Dinamarca','Japon','Camerun'],['Italia','Paraguay','Eslovaquia','Nueva Zelanda'],['Brasil','Corea del Norte','Costa de Marfil','Portugal'],['Espana','Suiza','Honduras','Chile']] },
  { year:2014, format:'groups32_ko',       host:'Brasil',
    normativa:'8 grupos → octavos · DAG',
    groups:[['Brasil','Croacia','Mexico','Camerun'],['Espana','Holanda','Chile','Australia'],['Colombia','Grecia','Costa de Marfil','Japon'],['Uruguay','Costa Rica','Inglaterra','Italia'],['Francia','Honduras','Ecuador','Suiza'],['Argentina','Bosnia','Iran','Nigeria'],['Alemania','Portugal','Ghana','EE.UU.'],['Belgica','Argelia','Rusia','Corea del Sur']] },
  { year:2018, format:'groups32_ko',       host:'Rusia',
    normativa:'8 grupos → octavos · VAR',
    groups:[['Rusia','Arabia Saudi','Egipto','Uruguay'],['Portugal','Espana','Marruecos','Iran'],['Francia','Australia','Peru','Dinamarca'],['Argentina','Islandia','Croacia','Nigeria'],['Brasil','Suiza','Costa Rica','Serbia'],['Alemania','Mexico','Suecia','Corea del Sur'],['Belgica','Panama','Tunez','Inglaterra'],['Polonia','Senegal','Colombia','Japon']] },
  { year:2022, format:'groups32_ko',       host:'Catar',
    normativa:'8 grupos → octavos · 32 sel. · primera vez en invierno',
    groups:[['Catar','Ecuador','Senegal','Paises Bajos'],['Inglaterra','Iran','EE.UU.','Gales'],['Argentina','Arabia Saudi','Mexico','Polonia'],['Francia','Australia','Dinamarca','Tunez'],['Espana','Costa Rica','Alemania','Japon'],['Belgica','Canada','Marruecos','Croacia'],['Brasil','Serbia','Suiza','Camerun'],['Portugal','Ghana','Uruguay','Corea del Sur']] },
  // 2026 is a special entry — clicking it routes to loadPreset('wc2026')
  { year:2026, format:'wc2026',            host:'EE.UU./Canadá/México',
    normativa:'12 grupos → dieciseisavos · 48 sel.', groups:null },
];

// Mapping from simplified (no accents) team name back to accented for TEAM_MAP lookup
const ACCENT_FIX = {
  'Mexico':'México','Belgica':'Bélgica','Espana':'España','Paises Bajos':'Países Bajos',
  'Hungria':'Hungría','Tunez':'Túnez','Turquia':'Turquía','Peru':'Perú',
  'Japon':'Japón','Haiti':'Haití','Canada':'Canadá','Panama':'Panamá',
  'Sudafrica':'Sudáfrica','Corea del Norte':'Corea del Norte','Corea del Sur':'Corea del Sur',
  'Argelia':'Argelia','Alemania':'Alemania','Croacia':'Croacia','Camerun':'Camerún',
  'Arabia Saudi':'Arabia Saudí','Republica Checa':'Rep. Checa','Serbia':'Serbia',
  'Rumania':'Rumania','Eslovaquia':'Eslovaquia','Islandia':'Islandia','Eslovenia':'Eslovenia',
  'Polonia':'Polonia','Irlanda':'Irlanda','Irlanda del Norte':'Irlanda del Norte',
  'Suecia':'Suecia','Suiza':'Suiza','Dinamarca':'Dinamarca','Noruega':'Noruega',
  'Italia':'Italia','Francia':'Francia','Brasil':'Brasil','Argentina':'Argentina',
  'Uruguay':'Uruguay','Colombia':'Colombia','Chile':'Chile','Bolivia':'Bolivia',
  'Paraguay':'Paraguay','Ecuador':'Ecuador','Rusia':'Rusia','Ucrania':'Ucrania',
  'Egipto':'Egipto','Marruecos':'Marruecos','Nigeria':'Nigeria','Ghana':'Ghana',
  'Senegal':'Senegal','Tunez':'Túnez','Togo':'Togo','Angola':'Angola',
  'Costa de Marfil':'Costa de Marfil','Sudafrica':'Sudáfrica',
  'Holanda':'Holanda','Zaire':'Zaire','Yugoslavia':'Yugoslavia','URSS':'URSS',
  'Checoslovaquia':'Checoslovaquia','EAU':'EAU','EE.UU.':'EE.UU.',
  'Estados Unidos':'Estados Unidos','Costa Rica':'Costa Rica','Cuba':'Cuba',
  'Indonesia':'Indonesia','Nueva Zelanda':'Nueva Zelanda','Kuwait':'Kuwait',
  'Australia':'Australia','Austria':'Austria','Catar':'Catar','Gales':'Gales',
  'Islandia':'Islandia','Iran':'Irán','Irak':'Irak','Israel':'Israel',
  'Trinidad y Tobago':'Trinidad y Tobago','Serbia y Montenegro':'Serbia y Montenegro',
  'Bosnia':'Bosnia','El Salvador':'El Salvador','Honduras':'Honduras',
  'Jamaica':'Jamaica','China':'China','India':'India',
};

function resolveName(raw) {
  return ACCENT_FIX[raw] || raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. BUILD
// ─────────────────────────────────────────────────────────────────────────────
const GROUP_LABELS = 'ABCDEFGHIJKL'.split('');

function resolveTeam(rawName, year) {
  const name  = resolveName(rawName);
  const entry = TEAM_MAP[name];
  if (!entry) {
    console.warn(`  WARNING: no mapping for "${name}" (${year})`);
    return { slug: name.toLowerCase().replace(/\s/g,'-').replace(/[^a-z0-9-]/g,''), era: String(year), name, badge: '/img/badges/_placeholder.svg' };
  }
  const key  = entry.slug + ':' + year;
  const era  = ERA_OVERRIDES[key] || String(year);
  return { slug: entry.slug, era, name, badge: '/img/badges/' + entry.badge };
}

function buildEdition(ed) {
  if (ed.format === 'cancelled') return { year: ed.year, format: 'cancelled', host: null, normativa: ed.normativa, groups: null };
  if (ed.format === 'wc2026')    return { year: ed.year, format: 'wc2026',    host: ed.host, normativa: ed.normativa, groups: null };
  if (!ed.groups) return null;
  const groups = ed.groups.map((grp, gi) => ({
    label: GROUP_LABELS[gi],
    teams: grp.map(n => resolveTeam(n, ed.year)),
  }));
  return { year: ed.year, format: ed.format, host: ed.host, normativa: ed.normativa, groups };
}

const editions = EDITIONS_RAW.map(buildEdition).filter(Boolean);

// Coverage report
console.log('\n=== COVERAGE REPORT ===');
let totalMapped = 0, totalPh = 0;
editions.forEach(ed => {
  if (!ed.groups) {
    console.log(ed.year + '  ' + (ed.format === 'cancelled' ? 'CANCELADA' : 'WC 2026 especial'));
    return;
  }
  const teams  = ed.groups.flatMap(g => g.teams);
  const mapped = teams.filter(t => !t.badge.includes('_placeholder')).length;
  const ph     = teams.filter(t =>  t.badge.includes('_placeholder')).length;
  totalMapped += mapped; totalPh += ph;
  const pct = Math.round(mapped / teams.length * 100);
  const phNames = teams.filter(t => t.badge.includes('_placeholder')).map(t => t.name);
  console.log(ed.year + '  ' + String(teams.length).padStart(2) + ' equipos  ' + pct + '% covered' + (phNames.length ? '  <- sin datos: ' + phNames.join(', ') : ''));
});
console.log('\nTotal: ' + totalMapped + ' con squad, ' + totalPh + ' con placeholder');

// Generate JS
const lines = [
  '// AUTO-GENERATED by _build_wc_editions.js — DO NOT EDIT MANUALLY',
  '/* eslint-disable */',
  '',
  'const _WC_EDITION_YEARS = [' + editions.map(e => e.year).join(', ') + '];',
  '',
  'const _WC_EDITIONS = {',
];

editions.forEach(ed => {
  if (ed.format === 'cancelled') {
    lines.push('  ' + ed.year + ': { year: ' + ed.year + ', format: \'cancelled\', host: null, normativa: \'' + ed.normativa + '\', groups: null },');
    return;
  }
  if (ed.format === 'wc2026') {
    lines.push('  ' + ed.year + ': { year: ' + ed.year + ', format: \'wc2026\', host: \'' + ed.host + '\', normativa: \'' + ed.normativa + '\', groups: null },');
    return;
  }
  lines.push('  ' + ed.year + ': {');
  lines.push('    year: ' + ed.year + ', format: \'' + ed.format + '\', host: \'' + ed.host + '\',');
  lines.push('    normativa: \'' + ed.normativa + '\',');
  lines.push('    groups: [');
  ed.groups.forEach(grp => {
    lines.push('      { label: \'' + grp.label + '\', teams: [');
    grp.teams.forEach(t => {
      lines.push('        { slug: \'' + t.slug + '\', era: \'' + t.era + '\', name: \'' + t.name.replace(/'/g,"\\'")+'\', badge: \'' + t.badge + '\' },');
    });
    lines.push('      ] },');
  });
  lines.push('    ],');
  lines.push('  },');
});

lines.push('};');

const out = path.join(__dirname, 'public', '_wc_editions.js');
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log('\nWritten to ' + out + ' (' + lines.length + ' lines)');
