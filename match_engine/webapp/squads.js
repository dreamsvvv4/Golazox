/**
 * squads.js — Football Match Simulator squad database
 * ═══════════════════════════════════════════════════════════════
 * +60 squads: clubs históricos, selecciones, eras específicas.
 *
 * ESTRUCTURA DE CLAVE:
 *   Cada entrada: { formation, ratings, players[], aliases[] }
 *   aliases[]: términos adicionales para el matching automático.
 *   ratings: ATK/MID/DEF/GK (0-100) — anula la estimación heurística.
 *
 * MATCHING: el engine busca por nombre + año/era del usuario.
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const SQUADS = {

  // ══════════════════════════════════════════════════════════
  //  REAL MADRID
  // ══════════════════════════════════════════════════════════

  'real madrid 1956': {
    aliases: ['real madrid 1955','real madrid 1957','madrid di stefano','madrid copa europa 1956'],
    formation: '4-2-4',
    ratings: { attack:91, midfield:84, defense:79, goalkeeping:80 },
    players: [
      { name: 'Juan Alonso',       position: 'GK' },
      { name: 'Marcos Marquitos',  position: 'RB' },
      { name: 'José Santamaría',   position: 'CB' },
      { name: 'Miguel Muñoz',      position: 'CB' },
      { name: 'Pachin',            position: 'LB' },
      { name: 'Héctor Rial',       position: 'RM' },
      { name: 'Enrique Mateos',    position: 'CM' },
      { name: 'Raymond Kopa',      position: 'LM' },
      { name: 'Francisco Gento',   position: 'LW' },
      { name: 'Alfredo Di Stéfano',position: 'ST' },
      { name: 'Ferenc Puskás',     position: 'RW' },
    ]
  },

  'real madrid 1960': {
    aliases: ['real madrid 1959','real madrid 1961','madrid 7-3'],
    formation: '4-2-4',
    ratings: { attack:96, midfield:86, defense:80, goalkeeping:81 },
    players: [
      { name: 'Rogelio Domínguez', position: 'GK' },
      { name: 'Marcos Marquitos',  position: 'RB' },
      { name: 'José Santamaría',   position: 'CB' },
      { name: 'Pachin',            position: 'CB' },
      { name: 'Jesús Vidal',       position: 'LB' },
      { name: 'José María Zárraga',position: 'DM' },
      { name: 'Luis Del Sol',      position: 'CM' },
      { name: 'Francisco Gento',   position: 'LW' },
      { name: 'Raymond Kopa',      position: 'AM' },
      { name: 'Alfredo Di Stéfano',position: 'ST' },
      { name: 'Ferenc Puskás',     position: 'RW' },
    ]
  },

  'real madrid 1998': {
    aliases: ['real madrid 1997','real madrid 1997-98','madrid champions 1998'],
    formation: '4-4-2',
    ratings: { attack:88, midfield:86, defense:85, goalkeeping:86 },
    players: [
      { name: 'Illgner',          position: 'GK' },
      { name: 'Hierro',           position: 'RB' },
      { name: 'Karanka',          position: 'CB' },
      { name: 'Sanchís',          position: 'CB' },
      { name: 'Roberto Carlos',   position: 'LB' },
      { name: 'Redondo',          position: 'DM' },
      { name: 'Mijatovic',        position: 'RM' },
      { name: 'Raúl',             position: 'LM' },
      { name: 'Seedorf',          position: 'CM' },
      { name: 'Suker',            position: 'ST' },
      { name: 'Morientes',        position: 'ST' },
    ]
  },

  'real madrid 2002': {
    aliases: ['real madrid 2001','real madrid 2002-03','galacticos','real madrid zidane ronaldo','madrid galacticos'],
    formation: '4-4-2',
    ratings: { attack:96, midfield:90, defense:82, goalkeeping:87 },
    players: [
      { name: 'Iker Casillas',     position: 'GK' },
      { name: 'Michel Salgado',    position: 'RB' },
      { name: 'Hierro',            position: 'CB' },
      { name: 'Helguera',          position: 'CB' },
      { name: 'Roberto Carlos',    position: 'LB' },
      { name: 'Luis Figo',         position: 'RM' },
      { name: 'Claude Makélélé',   position: 'DM' },
      { name: 'Steve McManaman',   position: 'LM' },
      { name: 'Zinedine Zidane',   position: 'AM' },
      { name: 'Raúl',              position: 'ST' },
      { name: 'Ronaldo Nazário',   position: 'ST' },
    ]
  },

  'real madrid 2012': {
    aliases: ['real madrid 2011-12','real madrid mourinho','madrid 2011','madrid 2012'],
    formation: '4-2-3-1',
    ratings: { attack:92, midfield:87, defense:87, goalkeeping:90 },
    players: [
      { name: 'Iker Casillas',     position: 'GK' },
      { name: 'Sergio Ramos',      position: 'RB' },
      { name: 'Pepe',              position: 'CB' },
      { name: 'Raphael Varane',    position: 'CB' },
      { name: 'Marcelo',           position: 'LB' },
      { name: 'Xabi Alonso',       position: 'DM' },
      { name: 'Sami Khedira',      position: 'DM' },
      { name: 'Cristiano Ronaldo', position: 'LW' },
      { name: 'Mesut Özil',        position: 'AM' },
      { name: 'Karim Benzema',     position: 'ST' },
      { name: 'Angel Di María',    position: 'RW' },
    ]
  },

  'real madrid 2014': {
    aliases: ['real madrid 2013-14','real madrid ancelotti','madrid ucl 2014','decima'],
    formation: '4-3-3',
    ratings: { attack:94, midfield:88, defense:85, goalkeeping:90 },
    players: [
      { name: 'Iker Casillas',     position: 'GK' },
      { name: 'Dani Carvajal',     position: 'RB' },
      { name: 'Sergio Ramos',      position: 'CB' },
      { name: 'Raphael Varane',    position: 'CB' },
      { name: 'Marcelo',           position: 'LB' },
      { name: 'Xabi Alonso',       position: 'DM' },
      { name: 'Luka Modric',       position: 'CM' },
      { name: 'Sami Khedira',      position: 'CM' },
      { name: 'Cristiano Ronaldo', position: 'LW' },
      { name: 'Karim Benzema',     position: 'ST' },
      { name: 'Gareth Bale',       position: 'RW' },
    ]
  },

  'real madrid 2017': {
    aliases: ['real madrid 2016-17','real madrid 2015-16','madrid zidane ucl'],
    formation: '4-3-3',
    ratings: { attack:93, midfield:89, defense:86, goalkeeping:91 },
    players: [
      { name: 'Keylor Navas',      position: 'GK' },
      { name: 'Dani Carvajal',     position: 'RB' },
      { name: 'Sergio Ramos',      position: 'CB' },
      { name: 'Raphael Varane',    position: 'CB' },
      { name: 'Marcelo',           position: 'LB' },
      { name: 'Luka Modric',       position: 'CM' },
      { name: 'Casemiro',          position: 'DM' },
      { name: 'Toni Kroos',        position: 'CM' },
      { name: 'Cristiano Ronaldo', position: 'LW' },
      { name: 'Karim Benzema',     position: 'ST' },
      { name: 'Gareth Bale',       position: 'RW' },
    ]
  },

  'real madrid 2022': {
    aliases: ['real madrid 2021-22','real madrid 2022-23','real madrid ancelotti 2022','real madrid actual'],
    formation: '4-3-3',
    ratings: { attack:92, midfield:90, defense:86, goalkeeping:93 },
    players: [
      { name: 'Thibaut Courtois',  position: 'GK' },
      { name: 'Dani Carvajal',     position: 'RB' },
      { name: 'Éder Militão',      position: 'CB' },
      { name: 'David Alaba',       position: 'CB' },
      { name: 'Ferland Mendy',     position: 'LB' },
      { name: 'Luka Modric',       position: 'CM' },
      { name: 'Casemiro',          position: 'DM' },
      { name: 'Toni Kroos',        position: 'CM' },
      { name: 'Federico Valverde', position: 'RW' },
      { name: 'Karim Benzema',     position: 'ST' },
      { name: 'Vinicius Jr',       position: 'LW' },
    ]
  },

  'real madrid': {
    aliases: ['real madrid 2024','real madrid 2025','real madrid 2026','madrid hoy'],
    formation: '4-3-3',
    ratings: { attack:91, midfield:89, defense:85, goalkeeping:90 },
    players: [
      { name: 'Thibaut Courtois',  position: 'GK' },
      { name: 'Dani Carvajal',     position: 'RB' },
      { name: 'Éder Militão',      position: 'CB' },
      { name: 'Antonio Rüdiger',   position: 'CB' },
      { name: 'Ferland Mendy',     position: 'LB' },
      { name: 'Jude Bellingham',   position: 'AM' },
      { name: 'Luka Modric',       position: 'CM' },
      { name: 'Toni Kroos',        position: 'CM' },
      { name: 'Federico Valverde', position: 'RW' },
      { name: 'Kylian Mbappé',     position: 'ST' },
      { name: 'Vinicius Jr',       position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  FC BARCELONA
  // ══════════════════════════════════════════════════════════

  'barcelona 1974': {
    aliases: ['barça 1974','barcelona cruyff 1974','barca 1973-74','fc barcelona 1974'],
    formation: '4-3-3',
    ratings: { attack:90, midfield:87, defense:80, goalkeeping:78 },
    players: [
      { name: 'Sadurní',          position: 'GK' },
      { name: 'Juan Carlos',      position: 'RB' },
      { name: 'Joaquim Rifé',     position: 'CB' },
      { name: 'Gallego',          position: 'CB' },
      { name: 'Sotil',            position: 'LB' },
      { name: 'Asensi',           position: 'LW' },
      { name: "Neeskens",         position: 'DM' },
      { name: 'Carlos Rexach',    position: 'AM' },
      { name: 'Johan Cruyff',     position: 'RW' },
      { name: 'Marcial Pina',     position: 'ST' },
      { name: 'Carles Rexach',    position: 'LW' },
    ]
  },

  'barcelona 1992': {
    aliases: ['barça 1992','barcelona dream team','barcelona 1991-92','barca 1992','fc barcelona 1992','barcelona cruyff 1992'],
    formation: '3-4-3',
    ratings: { attack:90, midfield:91, defense:81, goalkeeping:79 },
    players: [
      { name: 'Andoni Zubizarreta', position: 'GK' },
      { name: 'Juan Carlos',        position: 'CB' },
      { name: 'Ronald Koeman',      position: 'CB' },
      { name: 'Albert Ferrer',      position: 'CB' },
      { name: 'Sergi Barjuán',      position: 'LM' },
      { name: 'Pep Guardiola',      position: 'DM' },
      { name: 'Guillermo Amor',     position: 'CM' },
      { name: 'Txiki Begiristain',  position: 'RM' },
      { name: 'Hristo Stoichkov',   position: 'LW' },
      { name: 'Romário',            position: 'ST' },
      { name: 'Michael Laudrup',    position: 'RW' },
    ]
  },

  'barcelona 1999': {
    aliases: ['barcelona 1998-99','barça 1999','barca van gaal 1999','barcelona champions 1999'],
    formation: '4-3-3',
    ratings: { attack:88, midfield:87, defense:82, goalkeeping:82 },
    players: [
      { name: 'Ruud Hesp',         position: 'GK' },
      { name: 'Sergi Barjuán',     position: 'RB' },
      { name: 'Miguel Ángel Nadal',position: 'CB' },
      { name: 'Luis Enrique',      position: 'CB' },
      { name: 'Abelardo',          position: 'LB' },
      { name: 'Giovanni',          position: 'RM' },
      { name: 'Pep Guardiola',     position: 'DM' },
      { name: 'Philip Cocu',       position: 'CM' },
      { name: 'Rivaldo',           position: 'LW' },
      { name: 'Patrick Kluivert',  position: 'ST' },
      { name: 'Luis Figo',         position: 'RW' },
    ]
  },

  'barcelona 2006': {
    aliases: ['barcelona 2005-06','barça 2006','barca rijkaard 2006','barcelona champions 2006'],
    formation: '4-3-3',
    ratings: { attack:91, midfield:89, defense:83, goalkeeping:82 },
    players: [
      { name: 'Víctor Valdés',    position: 'GK' },
      { name: 'Dani Alves',       position: 'RB' },
      { name: 'Carles Puyol',     position: 'CB' },
      { name: 'Rafael Márquez',   position: 'CB' },
      { name: 'Silvinho',         position: 'LB' },
      { name: 'Deco',             position: 'AM' },
      { name: 'Xavi Hernández',   position: 'CM' },
      { name: 'Andrés Iniesta',   position: 'CM' },
      { name: 'Samuel Eto\'o',    position: 'RW' },
      { name: 'Ronaldinho',       position: 'LW' },
      { name: 'Henrik Larsson',   position: 'ST' },
    ]
  },

  'barcelona 2009': {
    aliases: ['barcelona 2008-09','barça 2009','barca guardiola 2009','barca treble 2009','barcelona treble'],
    formation: '4-3-3',
    ratings: { attack:94, midfield:94, defense:84, goalkeeping:83 },
    players: [
      { name: 'Víctor Valdés',    position: 'GK' },
      { name: 'Dani Alves',       position: 'RB' },
      { name: 'Carles Puyol',     position: 'CB' },
      { name: 'Gerard Piqué',     position: 'CB' },
      { name: 'Eric Abidal',      position: 'LB' },
      { name: 'Sergio Busquets',  position: 'DM' },
      { name: 'Xavi Hernández',   position: 'CM' },
      { name: 'Andrés Iniesta',   position: 'CM' },
      { name: 'Lionel Messi',     position: 'RW' },
      { name: 'Samuel Eto\'o',    position: 'ST' },
      { name: 'Thierry Henry',    position: 'LW' },
    ]
  },

  'barcelona 2011': {
    aliases: ['barça 2011','barcelona 2010-11','barca guardiola 2011','barcelona champions 2011','mejor barca'],
    formation: '4-3-3',
    ratings: { attack:96, midfield:96, defense:85, goalkeeping:83 },
    players: [
      { name: 'Víctor Valdés',    position: 'GK' },
      { name: 'Dani Alves',       position: 'RB' },
      { name: 'Carles Puyol',     position: 'CB' },
      { name: 'Gerard Piqué',     position: 'CB' },
      { name: 'Adriano',          position: 'LB' },
      { name: 'Sergio Busquets',  position: 'DM' },
      { name: 'Xavi Hernández',   position: 'CM' },
      { name: 'Andrés Iniesta',   position: 'CM' },
      { name: 'Lionel Messi',     position: 'RW' },
      { name: 'David Villa',      position: 'ST' },
      { name: 'Pedro Rodríguez',  position: 'LW' },
    ]
  },

  'barcelona 2015': {
    aliases: ['barça 2015','barcelona 2014-15','barca luis enrique 2015','barcelona treble 2015','messi suarez neymar'],
    formation: '4-3-3',
    ratings: { attack:97, midfield:92, defense:84, goalkeeping:83 },
    players: [
      { name: 'Claudio Bravo',    position: 'GK' },
      { name: 'Dani Alves',       position: 'RB' },
      { name: 'Gerard Piqué',     position: 'CB' },
      { name: 'Javier Mascherano',position: 'CB' },
      { name: 'Jordi Alba',       position: 'LB' },
      { name: 'Sergio Busquets',  position: 'DM' },
      { name: 'Xavi Hernández',   position: 'CM' },
      { name: 'Andrés Iniesta',   position: 'CM' },
      { name: 'Lionel Messi',     position: 'RW' },
      { name: 'Luis Suárez',      position: 'ST' },
      { name: 'Neymar Jr',        position: 'LW' },
    ]
  },

  'barcelona': {
    aliases: ['barcelona 2024','barça actual','fc barcelona 2025','fc barcelona 2026'],
    formation: '4-3-3',
    ratings: { attack:88, midfield:89, defense:83, goalkeeping:84 },
    players: [
      { name: 'Marc-André ter Stegen', position: 'GK' },
      { name: 'Jules Koundé',          position: 'RB' },
      { name: 'Ronald Araújo',         position: 'CB' },
      { name: 'Pau Cubarsí',           position: 'CB' },
      { name: 'Alejandro Balde',       position: 'LB' },
      { name: 'Marc Casadó',           position: 'DM' },
      { name: 'Pedri',                 position: 'CM' },
      { name: 'Gavi',                  position: 'CM' },
      { name: 'Lamine Yamal',          position: 'RW' },
      { name: 'Robert Lewandowski',    position: 'ST' },
      { name: 'Raphinha',              position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  AC MILAN
  // ══════════════════════════════════════════════════════════

  'ac milan 1963': {
    aliases: ['milan 1963','milan 1962-63','ac milan rivera'],
    formation: '4-2-4',
    ratings: { attack:85, midfield:83, defense:83, goalkeeping:80 },
    players: [
      { name: 'Giorgio Ghezzi',    position: 'GK' },
      { name: 'César Maldini',     position: 'RB' },
      { name: 'Francesco Trabant', position: 'CB' },
      { name: 'Karl-Heinz Schnellinger', position: 'CB' },
      { name: 'Gianni Rivera',     position: 'LB' },
      { name: 'Giovanni Trapattoni',position:'DM' },
      { name: 'Liedholm',          position: 'CM' },
      { name: 'Josè Altafini',     position: 'RW' },
      { name: 'Jimmy Greaves',     position: 'AM' },
      { name: 'Sandro Salvadore',  position: 'ST' },
      { name: 'Paolo Barison',     position: 'LW' },
    ]
  },

  'ac milan 1989': {
    aliases: ['milan 1989','ac milan sacchi','milan 1988-89','milan champions 1989','grande milan'],
    formation: '4-4-2',
    ratings: { attack:92, midfield:88, defense:94, goalkeeping:83 },
    players: [
      { name: 'Giovanni Galli',        position: 'GK' },
      { name: 'Mauro Tassotti',        position: 'RB' },
      { name: 'Alessandro Costacurta', position: 'CB' },
      { name: 'Franco Baresi',         position: 'CB' },
      { name: 'Paolo Maldini',         position: 'LB' },
      { name: 'Roberto Donadoni',      position: 'RM' },
      { name: 'Carlo Ancelotti',       position: 'CM' },
      { name: 'Frank Rijkaard',        position: 'DM' },
      { name: 'Alberigo Evani',        position: 'LM' },
      { name: 'Ruud Gullit',           position: 'ST' },
      { name: 'Marco van Basten',      position: 'ST' },
    ]
  },

  'ac milan 1994': {
    aliases: ['milan 1994','milan 1993-94','milan capello 1994','milan campeon 1994'],
    formation: '4-4-2',
    ratings: { attack:88, midfield:87, defense:95, goalkeeping:87 },
    players: [
      { name: 'Sebastiano Rossi',      position: 'GK' },
      { name: 'Mauro Tassotti',        position: 'RB' },
      { name: 'Alessandro Costacurta', position: 'CB' },
      { name: 'Franco Baresi',         position: 'CB' },
      { name: 'Paolo Maldini',         position: 'LB' },
      { name: 'Zvonimir Boban',        position: 'CM' },
      { name: 'Marcel Desailly',       position: 'DM' },
      { name: 'Demetrio Albertini',    position: 'CM' },
      { name: 'Savicevic',             position: 'AM' },
      { name: 'Daniele Massaro',       position: 'ST' },
      { name: 'Dejan Savicevic',       position: 'LW' },
    ]
  },

  'ac milan 2003': {
    aliases: ['milan 2003','milan 2002-03','milan ancelotti champions 2003','milan penalty manchester'],
    formation: '4-4-2',
    ratings: { attack:88, midfield:89, defense:93, goalkeeping:88 },
    players: [
      { name: 'Dida',               position: 'GK' },
      { name: 'Cafu',               position: 'RB' },
      { name: 'Alessandro Costacurta', position: 'CB' },
      { name: 'Paolo Maldini',      position: 'CB' },
      { name: 'Kakha Kaladze',      position: 'LB' },
      { name: 'Clarence Seedorf',   position: 'CM' },
      { name: 'Andrea Pirlo',       position: 'DM' },
      { name: 'Gennaro Gattuso',    position: 'DM' },
      { name: 'Rui Costa',          position: 'AM' },
      { name: 'Filippo Inzaghi',    position: 'ST' },
      { name: 'Andriy Shevchenko', position: 'ST' },
    ]
  },

  'ac milan 2007': {
    aliases: ['milan 2007','milan 2006-07','milan champions 2007','milan athens 2007'],
    formation: '4-3-2-1',
    ratings: { attack:87, midfield:88, defense:91, goalkeeping:88 },
    players: [
      { name: 'Dida',               position: 'GK' },
      { name: 'Cafu',               position: 'RB' },
      { name: 'Alessandro Costacurta', position: 'CB' },
      { name: 'Paolo Maldini',      position: 'CB' },
      { name: 'Marek Jankulovski',  position: 'LB' },
      { name: 'Gennaro Gattuso',    position: 'DM' },
      { name: 'Andrea Pirlo',       position: 'DM' },
      { name: 'Clarence Seedorf',   position: 'CM' },
      { name: 'Kaká',               position: 'AM' },
      { name: 'Filippo Inzaghi',    position: 'ST' },
      { name: 'Andriy Shevchenko', position: 'LW' },
    ]
  },

  'ac milan': {
    aliases: ['milan','ac milan actual','milan 2024'],
    formation: '4-2-3-1',
    ratings: { attack:83, midfield:82, defense:82, goalkeeping:82 },
    players: [
      { name: 'Mike Maignan',      position: 'GK' },
      { name: 'Davide Calabria',   position: 'RB' },
      { name: 'Malick Thiaw',      position: 'CB' },
      { name: 'Fikayo Tomori',     position: 'CB' },
      { name: 'Theo Hernández',    position: 'LB' },
      { name: 'Ruben Loftus-Cheek',position: 'CM' },
      { name: 'Tijjani Reijnders', position: 'CM' },
      { name: 'Samuel Chukwueze', position: 'RW' },
      { name: 'Christian Pulisic', position: 'AM' },
      { name: 'Álvaro Morata',     position: 'ST' },
      { name: 'Rafael Leão',       position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  INTERNAZIONALE
  // ══════════════════════════════════════════════════════════

  'inter 1965': {
    aliases: ['internazionale 1965','inter milan 1964-65','grande inter','inter herrera','inter 1964'],
    formation: '5-3-2',
    ratings: { attack:84, midfield:85, defense:92, goalkeeping:86 },
    players: [
      { name: 'Giuliano Sarti',    position: 'GK' },
      { name: 'Tarcísio Burgnich', position: 'RB' },
      { name: 'Armando Picchi',    position: 'CB' },
      { name: 'Aristide Guarneri', position: 'CB' },
      { name: 'Giacinto Facchetti',position: 'LB' },
      { name: 'Jair',              position: 'DM' },
      { name: 'Mario Corso',       position: 'AM' },
      { name: 'Luis Suárez (Inter)',position: 'CM' },
      { name: 'Sandro Mazzola',    position: 'RW' },
      { name: 'Aurelio Milani',    position: 'ST' },
      { name: 'Jair da Costa',     position: 'LW' },
    ]
  },

  'inter 2010': {
    aliases: ['internazionale 2010','inter milan 2009-10','inter mourinho','inter treble 2010','inter 2009-10'],
    formation: '4-2-3-1',
    ratings: { attack:89, midfield:88, defense:89, goalkeeping:87 },
    players: [
      { name: 'Júlio César',       position: 'GK' },
      { name: 'Maicon',            position: 'RB' },
      { name: 'Lúcio',             position: 'CB' },
      { name: 'Samuel',            position: 'CB' },
      { name: 'Chivu',             position: 'LB' },
      { name: 'Esteban Cambiasso', position: 'DM' },
      { name: 'Thiago Motta',      position: 'DM' },
      { name: 'Wesley Sneijder',   position: 'AM' },
      { name: 'Milito',            position: 'ST' },
      { name: 'Samuel Eto\'o',     position: 'RW' },
      { name: 'Goran Pandev',      position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  JUVENTUS
  // ══════════════════════════════════════════════════════════

  'juventus 1985': {
    aliases: ['juve 1985','juventus copa europa 1985','platini juve'],
    formation: '4-4-2',
    ratings: { attack:88, midfield:88, defense:88, goalkeeping:84 },
    players: [
      { name: 'Dino Zoff',         position: 'GK' },
      { name: 'Claudio Gentile',   position: 'RB' },
      { name: 'Gaetano Scirea',    position: 'CB' },
      { name: 'Antonio Cabrini',   position: 'CB' },
      { name: 'Lucio Favero',      position: 'LB' },
      { name: 'Michel Platini',    position: 'AM' },
      { name: 'Zbigniew Boniek',   position: 'CM' },
      { name: 'Stefano Tacconi',   position: 'RM' },
      { name: 'Marco Tardelli',    position: 'DM' },
      { name: 'Paolo Rossi',       position: 'ST' },
      { name: 'Roberto Bettega',   position: 'LW' },
    ]
  },

  'juventus 1996': {
    aliases: ['juve 1996','juventus champions 1996','juventus 1995-96','del piero juventus champions'],
    formation: '4-4-2',
    ratings: { attack:87, midfield:89, defense:89, goalkeeping:86 },
    players: [
      { name: 'Angelo Peruzzi',    position: 'GK' },
      { name: 'Ciro Ferrara',      position: 'RB' },
      { name: 'Paolo Montero',     position: 'CB' },
      { name: 'Mark Iuliano',      position: 'CB' },
      { name: 'Moreno Torricelli', position: 'LB' },
      { name: 'Didier Deschamps',  position: 'DM' },
      { name: 'Paulo Sousa',       position: 'CM' },
      { name: 'Dino Baggio',       position: 'CM' },
      { name: 'Fabrizio Ravanelli',position: 'RW' },
      { name: 'Gianluca Vialli',   position: 'ST' },
      { name: 'Alessandro Del Piero', position: 'LW' },
    ]
  },

  'juventus 2003': {
    aliases: ['juve 2003','juventus 2002-03','juve champions final 2003'],
    formation: '4-4-2',
    ratings: { attack:88, midfield:87, defense:90, goalkeeping:85 },
    players: [
      { name: 'Gianluigi Buffon',   position: 'GK' },
      { name: 'Lilian Thuram',      position: 'RB' },
      { name: 'Ciro Ferrara',       position: 'CB' },
      { name: 'Marcello Iuliano',   position: 'CB' },
      { name: 'Paolo Montero',      position: 'LB' },
      { name: 'Nedved',             position: 'CM' },
      { name: 'Edgar Davids',       position: 'DM' },
      { name: 'Mauro Camoranesi',   position: 'RM' },
      { name: 'Zinedine Zidane',    position: 'AM' },
      { name: 'Alessandro Del Piero', position: 'LW' },
      { name: 'Filippo Inzaghi',    position: 'ST' },
    ]
  },

  'juventus 2017': {
    aliases: ['juve 2017','juventus 2016-17','juve champions final 2017','juventus buffon 2017'],
    formation: '4-2-3-1',
    ratings: { attack:88, midfield:87, defense:89, goalkeeping:90 },
    players: [
      { name: 'Gianluigi Buffon',   position: 'GK' },
      { name: 'Dani Alves',         position: 'RB' },
      { name: 'Giorgio Chiellini',  position: 'CB' },
      { name: 'Leonardo Bonucci',   position: 'CB' },
      { name: 'Alex Sandro',        position: 'LB' },
      { name: 'Sami Khedira',       position: 'DM' },
      { name: 'Miralem Pjanic',     position: 'DM' },
      { name: 'Juan Cuadrado',      position: 'RW' },
      { name: 'Paulo Dybala',       position: 'AM' },
      { name: 'Mario Mandžukic',    position: 'LW' },
      { name: 'Gonzalo Higuaín',    position: 'ST' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  LIVERPOOL
  // ══════════════════════════════════════════════════════════

  'liverpool 1977': {
    aliases: ['liverpool 1976-77','liverpool shankly','liverpool paisley 1977'],
    formation: '4-4-2',
    ratings: { attack:87, midfield:86, defense:84, goalkeeping:83 },
    players: [
      { name: 'Ray Clemence',      position: 'GK' },
      { name: 'Phil Neal',         position: 'RB' },
      { name: 'Tommy Smith',       position: 'CB' },
      { name: 'Emlyn Hughes',      position: 'CB' },
      { name: 'Joey Jones',        position: 'LB' },
      { name: 'Terry McDermott',   position: 'RM' },
      { name: 'Jimmy Case',        position: 'CM' },
      { name: 'Ray Kennedy',       position: 'LM' },
      { name: 'Steve Heighway',    position: 'RW' },
      { name: 'David Johnson',     position: 'ST' },
      { name: 'Kevin Keegan',      position: 'LW' },
    ]
  },

  'liverpool 2005': {
    aliases: ['liverpool 2004-05','liverpool istanbul','liverpool miracle istanbul','liverpool gerrard 2005'],
    formation: '4-4-2',
    ratings: { attack:84, midfield:87, defense:82, goalkeeping:84 },
    players: [
      { name: 'Jerzy Dudek',       position: 'GK' },
      { name: 'Steve Finnan',      position: 'RB' },
      { name: 'Jamie Carragher',   position: 'CB' },
      { name: 'Sami Hyypiä',       position: 'CB' },
      { name: 'Djimi Traoré',      position: 'LB' },
      { name: 'Steve Gerrard',     position: 'CM' },
      { name: 'Xabi Alonso',       position: 'DM' },
      { name: 'Harry Kewell',      position: 'LM' },
      { name: 'Milan Baros',       position: 'ST' },
      { name: 'Djibril Cissé',     position: 'RW' },
      { name: 'Luis García',       position: 'AM' },
    ]
  },

  'liverpool 2019': {
    aliases: ['liverpool 2018-19','liverpool 2019-20','liverpool klopp champions','liverpool anfield 2019'],
    formation: '4-3-3',
    ratings: { attack:93, midfield:90, defense:89, goalkeeping:89 },
    players: [
      { name: 'Alisson Becker',    position: 'GK' },
      { name: 'Trent Alexander-Arnold', position: 'RB' },
      { name: 'Joel Matip',        position: 'CB' },
      { name: 'Virgil van Dijk',   position: 'CB' },
      { name: 'Andrew Robertson',  position: 'LB' },
      { name: 'Jordan Henderson',  position: 'DM' },
      { name: 'Georginio Wijnaldum', position: 'CM' },
      { name: 'Fabinho',           position: 'DM' },
      { name: 'Mohamed Salah',     position: 'RW' },
      { name: 'Roberto Firmino',   position: 'ST' },
      { name: 'Sadio Mané',        position: 'LW' },
    ]
  },

  'liverpool': {
    aliases: ['liverpool 2024','liverpool 2025','liverpool 2026','liverpool slot'],
    formation: '4-3-3',
    ratings: { attack:88, midfield:87, defense:86, goalkeeping:87 },
    players: [
      { name: 'Alisson Becker',    position: 'GK' },
      { name: 'Trent Alexander-Arnold', position: 'RB' },
      { name: 'Ibrahima Konaté',   position: 'CB' },
      { name: 'Virgil van Dijk',   position: 'CB' },
      { name: 'Andrew Robertson',  position: 'LB' },
      { name: 'Wataru Endo',       position: 'DM' },
      { name: 'Alexis Mac Allister', position: 'CM' },
      { name: 'Dominik Szoboszlai', position: 'CM' },
      { name: 'Mohamed Salah',     position: 'RW' },
      { name: 'Darwin Núñez',      position: 'ST' },
      { name: 'Luis Díaz',         position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  MANCHESTER UNITED
  // ══════════════════════════════════════════════════════════

  'manchester united 1968': {
    aliases: ['man utd 1968','manchester united busby 1968','busby babes 1968','man united champions 1968'],
    formation: '4-2-4',
    ratings: { attack:90, midfield:84, defense:80, goalkeeping:80 },
    players: [
      { name: 'Alex Stepney',      position: 'GK' },
      { name: 'Shay Brennan',      position: 'RB' },
      { name: 'Bill Foulkes',      position: 'CB' },
      { name: 'Tony Dunne',        position: 'CB' },
      { name: 'Francis Burns',     position: 'LB' },
      { name: 'Paddy Crerand',     position: 'DM' },
      { name: 'Bobby Charlton',    position: 'CM' },
      { name: 'George Best',       position: 'RW' },
      { name: 'Brian Kidd',        position: 'AM' },
      { name: 'Denis Law',         position: 'ST' },
      { name: 'John Aston',        position: 'LW' },
    ]
  },

  'manchester united 1999': {
    aliases: ['man utd 1999','manchester united treble','man united 1998-99','united treble ferguson'],
    formation: '4-4-2',
    ratings: { attack:91, midfield:88, defense:84, goalkeeping:84 },
    players: [
      { name: 'Peter Schmeichel',  position: 'GK' },
      { name: 'Gary Neville',      position: 'RB' },
      { name: 'Ronny Johnsen',     position: 'CB' },
      { name: 'Jaap Stam',         position: 'CB' },
      { name: 'Denis Irwin',       position: 'LB' },
      { name: 'Roy Keane',         position: 'DM' },
      { name: 'David Beckham',     position: 'RM' },
      { name: 'Nicky Butt',        position: 'CM' },
      { name: 'Ryan Giggs',        position: 'LM' },
      { name: 'Andy Cole',         position: 'ST' },
      { name: 'Dwight Yorke',      position: 'ST' },
    ]
  },

  'manchester united 2008': {
    aliases: ['man utd 2008','manchester united champions 2008','man united 2007-08','united ronaldo 2008'],
    formation: '4-4-2',
    ratings: { attack:92, midfield:89, defense:84, goalkeeping:83 },
    players: [
      { name: 'Edwin van der Sar', position: 'GK' },
      { name: 'Wes Brown',         position: 'RB' },
      { name: 'Rio Ferdinand',     position: 'CB' },
      { name: 'Nemanja Vidic',     position: 'CB' },
      { name: 'Patrice Evra',      position: 'LB' },
      { name: 'Michael Carrick',   position: 'DM' },
      { name: 'Paul Scholes',      position: 'CM' },
      { name: 'Owen Hargreaves',   position: 'CM' },
      { name: 'Cristiano Ronaldo', position: 'RW' },
      { name: 'Wayne Rooney',      position: 'ST' },
      { name: 'Carlos Tevez',      position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  ARSENAL
  // ══════════════════════════════════════════════════════════

  'arsenal 2004': {
    aliases: ['arsenal invincibles','arsenal 2003-04','arsenal wenger invincibles','arsenal unbeaten'],
    formation: '4-4-2',
    ratings: { attack:89, midfield:91, defense:87, goalkeeping:83 },
    players: [
      { name: 'Jens Lehmann',      position: 'GK' },
      { name: 'Lauren',            position: 'RB' },
      { name: 'Sol Campbell',      position: 'CB' },
      { name: 'Ashley Cole',       position: 'LB' },
      { name: 'Kolo Touré',        position: 'CB' },
      { name: 'Gilberto Silva',    position: 'DM' },
      { name: 'Patrick Vieira',    position: 'CM' },
      { name: 'Freddie Ljungberg', position: 'RM' },
      { name: 'Robert Pires',      position: 'LM' },
      { name: 'Dennis Bergkamp',   position: 'AM' },
      { name: 'Thierry Henry',     position: 'ST' },
    ]
  },

  'arsenal': {
    aliases: ['arsenal 2024','arsenal 2025','arsenal arteta','arsenal actual'],
    formation: '4-3-3',
    ratings: { attack:87, midfield:87, defense:87, goalkeeping:83 },
    players: [
      { name: 'David Raya',        position: 'GK' },
      { name: 'Ben White',         position: 'RB' },
      { name: 'William Saliba',    position: 'CB' },
      { name: 'Gabriel Magalhães', position: 'CB' },
      { name: 'Oleksandr Zinchenko', position: 'LB' },
      { name: 'Thomas Partey',     position: 'DM' },
      { name: 'Martin Ødegaard',   position: 'CM' },
      { name: 'Declan Rice',       position: 'CM' },
      { name: 'Bukayo Saka',       position: 'RW' },
      { name: 'Kai Havertz',       position: 'ST' },
      { name: 'Gabriel Martinelli',position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  MANCHESTER CITY
  // ══════════════════════════════════════════════════════════

  'manchester city 2023': {
    aliases: ['man city 2023','manchester city 2022-23','city treble 2023','city pep treble'],
    formation: '4-3-3',
    ratings: { attack:93, midfield:95, defense:87, goalkeeping:87 },
    players: [
      { name: 'Ederson',           position: 'GK' },
      { name: 'Kyle Walker',       position: 'RB' },
      { name: 'Rúben Dias',        position: 'CB' },
      { name: 'Manuel Akanji',     position: 'CB' },
      { name: 'Nathan Aké',        position: 'LB' },
      { name: 'Rodri',             position: 'DM' },
      { name: 'Kevin De Bruyne',   position: 'CM' },
      { name: 'Bernardo Silva',    position: 'CM' },
      { name: 'Phil Foden',        position: 'LW' },
      { name: 'Erling Haaland',    position: 'ST' },
      { name: 'Jack Grealish',     position: 'LW' },
    ]
  },

  'manchester city': {
    aliases: ['man city','manchester city 2024','manchester city 2025','man city guardiola'],
    formation: '4-3-3',
    ratings: { attack:90, midfield:92, defense:85, goalkeeping:86 },
    players: [
      { name: 'Ederson',           position: 'GK' },
      { name: 'Kyle Walker',       position: 'RB' },
      { name: 'Rúben Dias',        position: 'CB' },
      { name: 'Manuel Akanji',     position: 'CB' },
      { name: 'Josko Gvardiol',    position: 'LB' },
      { name: 'Rodri',             position: 'DM' },
      { name: 'Kevin De Bruyne',   position: 'CM' },
      { name: 'Bernardo Silva',    position: 'CM' },
      { name: 'Phil Foden',        position: 'RW' },
      { name: 'Erling Haaland',    position: 'ST' },
      { name: 'Jack Grealish',     position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  CHELSEA
  // ══════════════════════════════════════════════════════════

  'chelsea 2005': {
    aliases: ['chelsea 2004-05','chelsea mourinho 2005','chelsea champions england 2005'],
    formation: '4-3-3',
    ratings: { attack:87, midfield:88, defense:90, goalkeeping:86 },
    players: [
      { name: 'Petr Čech',         position: 'GK' },
      { name: 'Paulo Ferreira',    position: 'RB' },
      { name: 'Ricardo Carvalho',  position: 'CB' },
      { name: 'John Terry',        position: 'CB' },
      { name: 'Wayne Bridge',      position: 'LB' },
      { name: 'Claude Makélélé',   position: 'DM' },
      { name: 'Frank Lampard',     position: 'CM' },
      { name: 'Tiago',             position: 'CM' },
      { name: 'Joe Cole',          position: 'LW' },
      { name: 'Didier Drogba',     position: 'ST' },
      { name: 'Arjen Robben',      position: 'RW' },
    ]
  },

  'chelsea 2012': {
    aliases: ['chelsea 2011-12','chelsea champions 2012','chelsea di matteo 2012','chelsea munich 2012'],
    formation: '4-1-4-1',
    ratings: { attack:84, midfield:84, defense:87, goalkeeping:86 },
    players: [
      { name: 'Petr Čech',         position: 'GK' },
      { name: 'Branislav Ivanovic',position: 'RB' },
      { name: 'Gary Cahill',       position: 'CB' },
      { name: 'John Terry',        position: 'CB' },
      { name: 'Ashley Cole',       position: 'LB' },
      { name: 'John Obi Mikel',    position: 'DM' },
      { name: 'Frank Lampard',     position: 'CM' },
      { name: 'Ramires',           position: 'CM' },
      { name: 'Juan Mata',         position: 'AM' },
      { name: 'Salomon Kalou',     position: 'LW' },
      { name: 'Didier Drogba',     position: 'ST' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  AJAX
  // ══════════════════════════════════════════════════════════

  'ajax 1971': {
    aliases: ['ajax 1970-71','ajax champions 1971','ajax neeskens cruyff'],
    formation: '4-3-3',
    ratings: { attack:89, midfield:88, defense:82, goalkeeping:79 },
    players: [
      { name: 'Heinz Stuy',        position: 'GK' },
      { name: 'Wim Suurbier',      position: 'RB' },
      { name: 'Velibor Vasović',   position: 'CB' },
      { name: 'Barry Hulshoff',    position: 'CB' },
      { name: 'Ruud Krol',         position: 'LB' },
      { name: 'Johan Neeskens',    position: 'DM' },
      { name: 'Gerrie Mühren',     position: 'CM' },
      { name: 'Arie Haan',         position: 'CM' },
      { name: 'Johan Cruyff',      position: 'RW' },
      { name: 'Dick van Dijk',     position: 'ST' },
      { name: 'Piet Keizer',       position: 'LW' },
    ]
  },

  'ajax 1995': {
    aliases: ['ajax 1994-95','ajax champions 1995','ajax van gaal 1995','ajax kluivert 1995'],
    formation: '4-3-3',
    ratings: { attack:89, midfield:88, defense:86, goalkeeping:83 },
    players: [
      { name: 'Edwin van der Sar', position: 'GK' },
      { name: 'Michael Reiziger', position: 'RB' },
      { name: 'Danny Blind',      position: 'CB' },
      { name: 'Frank Rijkaard',   position: 'CB' },
      { name: 'Marciano Vink',    position: 'LB' },
      { name: 'Edgar Davids',     position: 'DM' },
      { name: 'Ronald de Boer',   position: 'CM' },
      { name: 'Frank de Boer',    position: 'CM' },
      { name: 'Marc Overmars',    position: 'RW' },
      { name: 'Patrick Kluivert', position: 'ST' },
      { name: 'Jari Litmanen',    position: 'LW' },
    ]
  },

  'ajax 2019': {
    aliases: ['ajax 2018-19','ajax ten hag 2019','ajax champions 2019','ajax juventus 2019'],
    formation: '4-3-3',
    ratings: { attack:87, midfield:87, defense:84, goalkeeping:83 },
    players: [
      { name: 'André Onana',       position: 'GK' },
      { name: 'Joel Veltman',      position: 'RB' },
      { name: 'Matthijs de Ligt',  position: 'CB' },
      { name: 'Daley Blind',       position: 'CB' },
      { name: 'Nicolas Tagliafico',position: 'LB' },
      { name: 'Lasse Schöne',      position: 'DM' },
      { name: 'Frenkie de Jong',   position: 'CM' },
      { name: 'Donny van de Beek', position: 'CM' },
      { name: 'Hakim Ziyech',      position: 'RW' },
      { name: 'Dusan Tadic',       position: 'ST' },
      { name: 'David Neres',       position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  BORUSSIA DORTMUND
  // ══════════════════════════════════════════════════════════

  'dortmund 2013': {
    aliases: ['borussia dortmund 2012-13','bvb 2013','dortmund champions 2013','klopp dortmund 2013'],
    formation: '4-2-3-1',
    ratings: { attack:88, midfield:87, defense:84, goalkeeping:82 },
    players: [
      { name: 'Roman Weidenfeller', position: 'GK' },
      { name: 'Lukasz Piszczek',    position: 'RB' },
      { name: 'Mats Hummels',       position: 'CB' },
      { name: 'Neven Subotic',      position: 'CB' },
      { name: 'Marcel Schmelzer',   position: 'LB' },
      { name: 'Sebastian Kehl',     position: 'DM' },
      { name: 'Ilkay Gündogan',     position: 'DM' },
      { name: 'Kevin Großkreutz',   position: 'RM' },
      { name: 'Mario Götze',        position: 'AM' },
      { name: 'Marco Reus',         position: 'LW' },
      { name: 'Robert Lewandowski', position: 'ST' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  BAYERN MUNICH
  // ══════════════════════════════════════════════════════════

  'bayern munich 1974': {
    aliases: ['bayern 1974','fc bayern 1974','beckenbauer bayern 1974','bayern champions 1974'],
    formation: '4-3-3',
    ratings: { attack:88, midfield:88, defense:88, goalkeeping:85 },
    players: [
      { name: 'Sepp Maier',        position: 'GK' },
      { name: 'Hans-Georg Schwarzenbeck', position: 'RB' },
      { name: 'Franz Beckenbauer', position: 'CB' },
      { name: 'Georg Schwarzenbeck',position: 'CB' },
      { name: 'Paul Breitner',     position: 'LB' },
      { name: 'Rainer Zobel',      position: 'DM' },
      { name: 'Uli Hoeness',       position: 'CM' },
      { name: 'Bernd Dürnberger',  position: 'RM' },
      { name: 'Conny Torstensson', position: 'RW' },
      { name: 'Gerd Müller',       position: 'ST' },
      { name: 'Karl-Heinz Rummenigge', position: 'LW' },
    ]
  },

  'bayern munich 2013': {
    aliases: ['bayern 2013','fc bayern 2012-13','bayern treble 2013','heynckes bayern 2013','bayern champions 2013'],
    formation: '4-2-3-1',
    ratings: { attack:91, midfield:91, defense:90, goalkeeping:90 },
    players: [
      { name: 'Manuel Neuer',      position: 'GK' },
      { name: 'Philipp Lahm',      position: 'RB' },
      { name: 'Dante',             position: 'CB' },
      { name: 'Jérome Boateng',    position: 'CB' },
      { name: 'David Alaba',       position: 'LB' },
      { name: 'Bastian Schweinsteiger', position: 'DM' },
      { name: 'Javi Martínez',     position: 'DM' },
      { name: 'Arjen Robben',      position: 'RW' },
      { name: 'Mario Götze',       position: 'AM' },
      { name: 'Thomas Müller',     position: 'LW' },
      { name: 'Mario Mandžukic',   position: 'ST' },
    ]
  },

  'bayern munich 2020': {
    aliases: ['bayern 2020','fc bayern 2019-20','flick bayern 2020','bayern sextuple 2020','lewandowski bayern 2020'],
    formation: '4-2-3-1',
    ratings: { attack:95, midfield:91, defense:89, goalkeeping:93 },
    players: [
      { name: 'Manuel Neuer',      position: 'GK' },
      { name: 'Benjamin Pavard',   position: 'RB' },
      { name: 'Niklas Süle',       position: 'CB' },
      { name: 'David Alaba',       position: 'CB' },
      { name: 'Alphonso Davies',   position: 'LB' },
      { name: 'Joshua Kimmich',    position: 'DM' },
      { name: 'Leon Goretzka',     position: 'DM' },
      { name: 'Serge Gnabry',      position: 'RW' },
      { name: 'Thomas Müller',     position: 'AM' },
      { name: 'Leroy Sané',        position: 'LW' },
      { name: 'Robert Lewandowski',position: 'ST' },
    ]
  },

  'bayern munich': {
    aliases: ['bayern munich 2024','bayern munich 2025','fc bayern actual','fc bayern munich'],
    formation: '4-2-3-1',
    ratings: { attack:88, midfield:87, defense:84, goalkeeping:89 },
    players: [
      { name: 'Manuel Neuer',      position: 'GK' },
      { name: 'Noussair Mazraoui', position: 'RB' },
      { name: 'Kim Min-jae',       position: 'CB' },
      { name: 'Dayot Upamecano',   position: 'CB' },
      { name: 'Alphonso Davies',   position: 'LB' },
      { name: 'Joshua Kimmich',    position: 'DM' },
      { name: 'Leon Goretzka',     position: 'DM' },
      { name: 'Jamal Musiala',     position: 'AM' },
      { name: 'Serge Gnabry',      position: 'RW' },
      { name: 'Harry Kane',        position: 'ST' },
      { name: 'Leroy Sané',        position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  PORTO
  // ══════════════════════════════════════════════════════════

  'porto 2004': {
    aliases: ['fc porto 2004','porto 2003-04','mourinho porto','porto champions 2004','porto deco 2004'],
    formation: '4-3-3',
    ratings: { attack:85, midfield:88, defense:86, goalkeeping:84 },
    players: [
      { name: 'Vítor Baía',        position: 'GK' },
      { name: 'Paulo Ferreira',    position: 'RB' },
      { name: 'Jorge Costa',       position: 'CB' },
      { name: 'Ricardo Carvalho',  position: 'CB' },
      { name: 'Nuno Valente',      position: 'LB' },
      { name: 'Maniche',           position: 'DM' },
      { name: 'Deco',              position: 'AM' },
      { name: 'Costinha',          position: 'CM' },
      { name: 'Dmitri Alenichev',  position: 'RW' },
      { name: 'Carlos Alberto',    position: 'ST' },
      { name: 'Derlei',            position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  CELTIC
  // ══════════════════════════════════════════════════════════

  'celtic 1967': {
    aliases: ['celtic lisbon lions','celtic 1966-67','lisbon lions','celtic champions 1967'],
    formation: '4-2-4',
    ratings: { attack:85, midfield:83, defense:82, goalkeeping:80 },
    players: [
      { name: 'Ronnie Simpson',    position: 'GK' },
      { name: 'Jim Craig',         position: 'RB' },
      { name: 'Tommy Gemmell',     position: 'CB' },
      { name: 'Billy McNeill',     position: 'CB' },
      { name: 'John Clark',        position: 'LB' },
      { name: 'Bobby Murdoch',     position: 'DM' },
      { name: 'Bertie Auld',       position: 'CM' },
      { name: 'Jimmy Johnstone',   position: 'RW' },
      { name: 'Willie Wallace',    position: 'AM' },
      { name: 'Stevie Chalmers',   position: 'ST' },
      { name: 'Bobby Lennox',      position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  BENFICA
  // ══════════════════════════════════════════════════════════

  'benfica 1962': {
    aliases: ['sl benfica 1962','benfica eusebio 1962','benfica champions 1962','benfica 1961-62'],
    formation: '4-2-4',
    ratings: { attack:88, midfield:83, defense:82, goalkeeping:81 },
    players: [
      { name: 'Alberto da Costa Pereira', position: 'GK' },
      { name: 'Cavém',             position: 'RB' },
      { name: 'Germano',           position: 'CB' },
      { name: 'Angelo Neto',       position: 'CB' },
      { name: 'Domiciano Cavém',   position: 'LB' },
      { name: 'Neto',              position: 'DM' },
      { name: 'Coluna',            position: 'CM' },
      { name: 'José Augusto',      position: 'RW' },
      { name: 'Aguas',             position: 'AM' },
      { name: 'Eusébio',           position: 'ST' },
      { name: 'Simoes',            position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  SELECCIONES NACIONALES
  // ══════════════════════════════════════════════════════════

  // ── BRASIL ──────────────────────────────────────────────

  'brasil 1958': {
    aliases: ['brazil 1958','brasil copa 1958','pele 1958 mundial','brasil mundial 1958'],
    formation: '4-2-4',
    ratings: { attack:92, midfield:85, defense:82, goalkeeping:79 },
    players: [
      { name: 'Gylmar',            position: 'GK' },
      { name: 'De Sordi',          position: 'RB' },
      { name: 'Bellini',           position: 'CB' },
      { name: 'Orlando',           position: 'CB' },
      { name: 'Nílton Santos',     position: 'LB' },
      { name: 'Dino',              position: 'RM' },
      { name: 'Zito',              position: 'DM' },
      { name: 'Garrincha',         position: 'RW' },
      { name: 'Didi',              position: 'AM' },
      { name: 'Pelé',              position: 'ST' },
      { name: 'Zagallo',           position: 'LW' },
    ]
  },

  'brasil 1970': {
    aliases: ['brazil 1970','brasil mexico 1970','brasil mundial 1970','pele brasil 1970','brasil copa mundo 1970'],
    formation: '4-2-4',
    ratings: { attack:95, midfield:87, defense:80, goalkeeping:74 },
    players: [
      { name: 'Félix',             position: 'GK' },
      { name: 'Carlos Alberto',    position: 'RB' },
      { name: 'Brito',             position: 'CB' },
      { name: 'Piazza',            position: 'CB' },
      { name: 'Everaldo',          position: 'LB' },
      { name: 'Clodoaldo',         position: 'DM' },
      { name: 'Gerson',            position: 'CM' },
      { name: 'Jairzinho',         position: 'RW' },
      { name: 'Tostão',            position: 'AM' },
      { name: 'Pelé',              position: 'ST' },
      { name: 'Rivelino',          position: 'LW' },
    ]
  },

  'brasil 1982': {
    aliases: ['brazil 1982','brasil copa 1982','brasil zico 1982','brasil mundial 1982'],
    formation: '4-2-4',
    ratings: { attack:93, midfield:92, defense:78, goalkeeping:80 },
    players: [
      { name: 'Waldir Peres',      position: 'GK' },
      { name: 'Leandro',           position: 'RB' },
      { name: 'Oscar',             position: 'CB' },
      { name: 'Luizinho',          position: 'CB' },
      { name: 'Júnior',            position: 'LB' },
      { name: 'Falcão',            position: 'DM' },
      { name: 'Cerezo',            position: 'CM' },
      { name: 'Sócrates',          position: 'AM' },
      { name: 'Zico',              position: 'RW' },
      { name: 'Careca',            position: 'ST' },
      { name: 'Éder',              position: 'LW' },
    ]
  },

  'brasil 1994': {
    aliases: ['brazil 1994','brasil copa 1994','brasil mundial 1994','brasil romario 1994'],
    formation: '4-4-2',
    ratings: { attack:89, midfield:86, defense:85, goalkeeping:84 },
    players: [
      { name: 'Taffarel',          position: 'GK' },
      { name: 'Aldair',            position: 'RB' },
      { name: 'Márcio Santos',     position: 'CB' },
      { name: 'Mazinho',           position: 'CB' },
      { name: 'Branco',            position: 'LB' },
      { name: 'Mauro Silva',       position: 'DM' },
      { name: 'Mazinho',           position: 'CM' },
      { name: 'Mauro Parreira Cafu',position: 'RM' },
      { name: 'Zinho',             position: 'AM' },
      { name: 'Romário',           position: 'ST' },
      { name: 'Bebeto',            position: 'ST' },
    ]
  },

  'brasil 2002': {
    aliases: ['brazil 2002','brasil copa 2002','brasil mundial 2002','3r 2002','ronaldo fenomeno 2002'],
    formation: '4-5-1',
    ratings: { attack:92, midfield:88, defense:82, goalkeeping:85 },
    players: [
      { name: 'Marcos',            position: 'GK' },
      { name: 'Cafu',              position: 'RB' },
      { name: 'Lúcio',             position: 'CB' },
      { name: 'Roque Júnior',      position: 'CB' },
      { name: 'Roberto Carlos',    position: 'LB' },
      { name: 'Gilberto Silva',    position: 'DM' },
      { name: 'Ronaldinho',        position: 'CM' },
      { name: 'Rivaldo',           position: 'AM' },
      { name: 'Kaká',              position: 'RW' },
      { name: 'Ronaldo Nazário',   position: 'ST' },
      { name: 'Edilson',           position: 'LW' },
    ]
  },

  // ── ARGENTINA ────────────────────────────────────────────

  'argentina 1978': {
    aliases: ['argentina copa 1978','argentina mundial 1978','argentina kempes 1978'],
    formation: '4-3-3',
    ratings: { attack:86, midfield:85, defense:83, goalkeeping:82 },
    players: [
      { name: 'Ubaldo Fillol',     position: 'GK' },
      { name: 'Jorge Olguin',      position: 'RB' },
      { name: 'Luis Galván',       position: 'CB' },
      { name: 'Daniel Passarella', position: 'CB' },
      { name: 'Alberto Tarantini', position: 'LB' },
      { name: 'Osvaldo Ardiles',   position: 'CM' },
      { name: 'Américo Gallego',   position: 'DM' },
      { name: 'René Houseman',     position: 'RW' },
      { name: 'Leopoldo Luque',    position: 'AM' },
      { name: 'Mario Kempes',      position: 'ST' },
      { name: 'Daniel Bertoni',    position: 'LW' },
    ]
  },

  'argentina 1986': {
    aliases: ['argentina copa 1986','argentina mundial 1986','argentina maradona 1986','argentina mexico 86'],
    formation: '4-3-3',
    ratings: { attack:91, midfield:87, defense:82, goalkeeping:81 },
    players: [
      { name: 'Nery Pumpido',      position: 'GK' },
      { name: 'Julio Olarticoechea',position: 'RB' },
      { name: 'José Luis Brown',   position: 'CB' },
      { name: 'Oscar Ruggeri',     position: 'CB' },
      { name: 'Ricardo Giusti',    position: 'LB' },
      { name: 'Héctor Enrique',    position: 'DM' },
      { name: 'Jorge Burruchaga',  position: 'CM' },
      { name: 'Sergio Batista',    position: 'CM' },
      { name: 'Diego Maradona',    position: 'AM' },
      { name: 'Jorge Valdano',     position: 'ST' },
      { name: 'Claudio Caniggia',  position: 'LW' },
    ]
  },

  'argentina 2022': {
    aliases: ['argentina copa 2022','argentina mundial 2022','argentina qatar 2022','argentina messi campeon'],
    formation: '4-3-3',
    ratings: { attack:90, midfield:87, defense:83, goalkeeping:83 },
    players: [
      { name: 'Emiliano Martínez', position: 'GK' },
      { name: 'Nahuel Molina',     position: 'RB' },
      { name: 'Cristian Romero',   position: 'CB' },
      { name: 'Nicolás Otamendi',  position: 'CB' },
      { name: 'Marcos Acuña',      position: 'LB' },
      { name: 'Rodrigo De Paul',   position: 'CM' },
      { name: 'Enzo Fernández',    position: 'DM' },
      { name: 'Alexis Mac Allister',position: 'CM' },
      { name: 'Lionel Messi',      position: 'RW' },
      { name: 'Julián Álvarez',    position: 'ST' },
      { name: 'Angel Di María',    position: 'LW' },
    ]
  },

  // ── ALEMANIA / GERMANY ────────────────────────────────────

  'alemania 1974': {
    aliases: ['germany 1974','west germany 1974','alemania copa 1974','rfa 1974','west germany world cup 1974'],
    formation: '4-3-3',
    ratings: { attack:88, midfield:86, defense:87, goalkeeping:86 },
    players: [
      { name: 'Sepp Maier',        position: 'GK' },
      { name: 'Berti Vogts',       position: 'RB' },
      { name: 'Franz Beckenbauer', position: 'CB' },
      { name: 'Hans-Georg Schwarzenbeck', position: 'CB' },
      { name: 'Paul Breitner',     position: 'LB' },
      { name: 'Rainer Bonhof',     position: 'DM' },
      { name: 'Uli Hoeness',       position: 'CM' },
      { name: 'Bernd Hölzenbein',  position: 'RW' },
      { name: 'Heinz Flohe',       position: 'AM' },
      { name: 'Gerd Müller',       position: 'ST' },
      { name: 'Axel Breitner',     position: 'LW' },
    ]
  },

  'germany 2014': {
    aliases: ['alemania 2014','alemania copa 2014','germany world cup 2014','alemania brasil 2014','germany brasil 7-1'],
    formation: '4-2-3-1',
    ratings: { attack:88, midfield:91, defense:87, goalkeeping:87 },
    players: [
      { name: 'Manuel Neuer',      position: 'GK' },
      { name: 'Philipp Lahm',      position: 'RB' },
      { name: 'Jérome Boateng',    position: 'CB' },
      { name: 'Mats Hummels',      position: 'CB' },
      { name: 'Benedikt Höwedes',  position: 'LB' },
      { name: 'Bastian Schweinsteiger', position: 'DM' },
      { name: 'Sami Khedira',      position: 'DM' },
      { name: 'Thomas Müller',     position: 'RW' },
      { name: 'Mesut Özil',        position: 'AM' },
      { name: 'Mario Götze',       position: 'LW' },
      { name: 'Miroslav Klose',    position: 'ST' },
    ]
  },

  // ── HOLANDA / NETHERLANDS ─────────────────────────────────

  'holanda 1974': {
    aliases: ['netherlands 1974','holland 1974','holanda copa 1974','naranja mecanica','cruyff holanda 1974'],
    formation: '4-3-3',
    ratings: { attack:93, midfield:92, defense:83, goalkeeping:82 },
    players: [
      { name: 'Jan Jongbloed',     position: 'GK' },
      { name: 'Wim Suurbier',      position: 'RB' },
      { name: 'Arie Haan',         position: 'CB' },
      { name: 'Rudi Krol',         position: 'CB' },
      { name: 'Wim Rijsbergen',    position: 'LB' },
      { name: 'Johan Neeskens',    position: 'DM' },
      { name: 'Wim Jansen',        position: 'CM' },
      { name: 'Johan Cruyff',      position: 'RW' },
      { name: 'Johnny Rep',        position: 'AM' },
      { name: 'Ruud Geels',        position: 'ST' },
      { name: 'Rob Rensenbrink',   position: 'LW' },
    ]
  },

  'holanda 1988': {
    aliases: ['netherlands 1988','holland 1988','holanda eurocopa 1988','holanda campeona 1988','van basten 1988','gullit 1988'],
    formation: '4-3-3',
    ratings: { attack:94, midfield:87, defense:84, goalkeeping:83 },
    players: [
      { name: 'Hans van Breukelen',position: 'GK' },
      { name: 'Berry van Aerle',   position: 'RB' },
      { name: 'Ronald Koeman',     position: 'CB' },
      { name: 'Adri van Tiggelen', position: 'CB' },
      { name: 'Frank Rijkaard',    position: 'LB' },
      { name: 'Erwin Koeman',      position: 'DM' },
      { name: 'Jan Wouters',       position: 'CM' },
      { name: 'Gerald Vanenburg',  position: 'RM' },
      { name: 'Ruud Gullit',       position: 'RW' },
      { name: 'Marco van Basten',  position: 'ST' },
      { name: 'Arnold Mühren',     position: 'LW' },
    ]
  },

  // ── ITALIA ───────────────────────────────────────────────

  'italia 1982': {
    aliases: ['italy 1982','italia copa 1982','italia mundial 1982','rossi italia 1982','italia españa 82'],
    formation: '4-4-2',
    ratings: { attack:83, midfield:84, defense:90, goalkeeping:87 },
    players: [
      { name: 'Dino Zoff',         position: 'GK' },
      { name: 'Claudio Gentile',   position: 'RB' },
      { name: 'Gaetano Scirea',    position: 'CB' },
      { name: 'Antonio Cabrini',   position: 'CB' },
      { name: 'Fulvio Collovati',  position: 'LB' },
      { name: 'Marco Tardelli',    position: 'CM' },
      { name: 'Gabriele Oriali',   position: 'DM' },
      { name: 'Bruno Conti',       position: 'RM' },
      { name: 'Francesco Graziani',position: 'LM' },
      { name: 'Paolo Rossi',       position: 'ST' },
      { name: 'Alessandro Altobelli',position: 'ST' },
    ]
  },

  'italia 2006': {
    aliases: ['italy 2006','italia copa 2006','italia mundial 2006','italia berlin 2006','azzurri 2006'],
    formation: '4-4-2',
    ratings: { attack:84, midfield:85, defense:92, goalkeeping:88 },
    players: [
      { name: 'Gianluigi Buffon',  position: 'GK' },
      { name: 'Gianluca Zambrotta',position: 'RB' },
      { name: 'Alessandro Nesta',  position: 'CB' },
      { name: 'Fabio Cannavaro',   position: 'CB' },
      { name: 'Fabio Grosso',      position: 'LB' },
      { name: 'Gennaro Gattuso',   position: 'DM' },
      { name: 'Andrea Pirlo',      position: 'CM' },
      { name: 'Mauro Camoranesi',  position: 'RM' },
      { name: 'Francesco Totti',   position: 'AM' },
      { name: 'Luca Toni',         position: 'ST' },
      { name: 'Alessandro Del Piero', position: 'LW' },
    ]
  },

  // ── ESPAÑA ───────────────────────────────────────────────

  'españa 2008': {
    aliases: ['spain 2008','españa eurocopa 2008','la roja 2008','españa campeona 2008'],
    formation: '4-1-4-1',
    ratings: { attack:88, midfield:93, defense:85, goalkeeping:84 },
    players: [
      { name: 'Iker Casillas',     position: 'GK' },
      { name: 'Sergio Ramos',      position: 'RB' },
      { name: 'Carlos Marchena',   position: 'CB' },
      { name: 'Carles Puyol',      position: 'CB' },
      { name: 'Joan Capdevila',    position: 'LB' },
      { name: 'Marcos Senna',      position: 'DM' },
      { name: 'Xavi Hernández',    position: 'CM' },
      { name: 'Andrés Iniesta',    position: 'CM' },
      { name: 'David Silva',       position: 'RW' },
      { name: 'Villa',             position: 'ST' },
      { name: 'Cesc Fàbregas',     position: 'LW' },
    ]
  },

  'españa 2010': {
    aliases: ['spain 2010','españa copa 2010','la roja 2010','españa campeona 2010','españa sudafrica 2010'],
    formation: '4-2-3-1',
    ratings: { attack:88, midfield:95, defense:87, goalkeeping:88 },
    players: [
      { name: 'Iker Casillas',     position: 'GK' },
      { name: 'Sergio Ramos',      position: 'RB' },
      { name: 'Gerard Piqué',      position: 'CB' },
      { name: 'Carles Puyol',      position: 'CB' },
      { name: 'Joan Capdevila',    position: 'LB' },
      { name: 'Sergio Busquets',   position: 'DM' },
      { name: 'Xavi Hernández',    position: 'CM' },
      { name: 'Andrés Iniesta',    position: 'AM' },
      { name: 'David Silva',       position: 'RW' },
      { name: 'David Villa',       position: 'ST' },
      { name: 'Pedro Rodríguez',   position: 'LW' },
    ]
  },

  'españa 2012': {
    aliases: ['spain 2012','españa eurocopa 2012','la roja 2012','españa campeona 2012'],
    formation: '4-3-3',
    ratings: { attack:89, midfield:96, defense:87, goalkeeping:88 },
    players: [
      { name: 'Iker Casillas',     position: 'GK' },
      { name: 'Sergio Ramos',      position: 'RB' },
      { name: 'Gerard Piqué',      position: 'CB' },
      { name: 'Jordi Alba',        position: 'LB' },
      { name: 'Álvaro Arbeloa',    position: 'CB' },
      { name: 'Sergio Busquets',   position: 'DM' },
      { name: 'Xavi Hernández',    position: 'CM' },
      { name: 'Andrés Iniesta',    position: 'CM' },
      { name: 'David Silva',       position: 'RW' },
      { name: 'Cesc Fàbregas',     position: 'ST' },
      { name: 'Fernando Torres',   position: 'LW' },
    ]
  },

  // ── HUNGRÍA ──────────────────────────────────────────────

  'hungria 1954': {
    aliases: ['hungary 1954','hungria copa 1954','magical magyars','puskas hungria','equipo de oro hungria'],
    formation: '4-2-4',
    ratings: { attack:96, midfield:91, defense:83, goalkeeping:83 },
    players: [
      { name: 'Gyula Grosics',     position: 'GK' },
      { name: 'Jenő Buzánszky',    position: 'RB' },
      { name: 'Gyula Lóránt',      position: 'CB' },
      { name: 'Mihály Lantos',     position: 'CB' },
      { name: 'József Zakariás',   position: 'LB' },
      { name: 'Józef Bozsik',      position: 'DM' },
      { name: 'Nándor Hidegkuti',  position: 'AM' },
      { name: 'László Budai',      position: 'RW' },
      { name: 'Ferenc Puskás',     position: 'ST' },
      { name: 'Sándor Kocsis',     position: 'ST' },
      { name: 'Zoltán Czibor',     position: 'LW' },
    ]
  },

  // ── FRANCE ───────────────────────────────────────────────

  'france 1998': {
    aliases: ['francia 1998','france coupe 1998','france world cup 1998','zidane france 1998'],
    formation: '4-2-3-1',
    ratings: { attack:85, midfield:90, defense:90, goalkeeping:90 },
    players: [
      { name: 'Fabien Barthez',    position: 'GK' },
      { name: 'Lilian Thuram',     position: 'RB' },
      { name: 'Marcel Desailly',   position: 'CB' },
      { name: 'Laurent Blanc',     position: 'CB' },
      { name: 'Bixente Lizarazu',  position: 'LB' },
      { name: 'Didier Deschamps',  position: 'DM' },
      { name: 'Emmanuel Petit',    position: 'DM' },
      { name: 'Zinedine Zidane',   position: 'AM' },
      { name: 'Youri Djorkaeff',   position: 'RW' },
      { name: "Stéphane Guivarc'h",position: 'ST' },
      { name: 'Thierry Henry',     position: 'LW' },
    ]
  },

  'france 2018': {
    aliases: ['francia 2018','france coupe 2018','france world cup 2018','mbappe france 2018'],
    formation: '4-2-3-1',
    ratings: { attack:90, midfield:88, defense:90, goalkeeping:84 },
    players: [
      { name: 'Hugo Lloris',       position: 'GK' },
      { name: 'Benjamin Pavard',   position: 'RB' },
      { name: 'Raphaël Varane',    position: 'CB' },
      { name: 'Samuel Umtiti',     position: 'CB' },
      { name: 'Lucas Hernández',   position: 'LB' },
      { name: 'N\'Golo Kanté',     position: 'DM' },
      { name: 'Paul Pogba',        position: 'DM' },
      { name: 'Ousmane Dembélé',   position: 'RW' },
      { name: 'Antoine Griezmann', position: 'AM' },
      { name: 'Olivier Giroud',    position: 'ST' },
      { name: 'Kylian Mbappé',     position: 'LW' },
    ]
  },

  // ── ENGLAND ──────────────────────────────────────────────

  'england 1966': {
    aliases: ['england world cup 1966','inglaterra 1966','england champions 1966','bobby moore england'],
    formation: '4-4-2',
    ratings: { attack:84, midfield:86, defense:87, goalkeeping:83 },
    players: [
      { name: 'Gordon Banks',      position: 'GK' },
      { name: 'George Cohen',      position: 'RB' },
      { name: 'Jack Charlton',     position: 'CB' },
      { name: 'Bobby Moore',       position: 'CB' },
      { name: 'Ray Wilson',        position: 'LB' },
      { name: 'Nobby Stiles',      position: 'DM' },
      { name: 'Bobby Charlton',    position: 'CM' },
      { name: 'Alan Ball',         position: 'RM' },
      { name: 'Martin Peters',     position: 'LM' },
      { name: 'Roger Hunt',        position: 'ST' },
      { name: 'Geoff Hurst',       position: 'ST' },
    ]
  },

  // ── PORTUGAL ─────────────────────────────────────────────

  'portugal 2016': {
    aliases: ['portugal eurocopa 2016','portugal champions 2016','portuguese euro 2016','ronaldo portugal 2016'],
    formation: '4-4-2',
    ratings: { attack:88, midfield:83, defense:83, goalkeeping:81 },
    players: [
      { name: 'Rui Patrício',      position: 'GK' },
      { name: 'Cédric Soares',     position: 'RB' },
      { name: 'José Fonte',        position: 'CB' },
      { name: 'Pepe',              position: 'CB' },
      { name: 'Raphaël Guerreiro', position: 'LB' },
      { name: 'Adrien Silva',      position: 'DM' },
      { name: 'William Carvalho',  position: 'DM' },
      { name: 'João Mário',        position: 'CM' },
      { name: 'Cristiano Ronaldo', position: 'RW' },
      { name: 'Éder',              position: 'ST' },
      { name: 'Nani',              position: 'LW' },
    ]
  },

  'portugal': {
    aliases: ['portugal 2024','portugal 2025','seleccion portuguesa','selecao portugal'],
    formation: '4-3-3',
    ratings: { attack:89, midfield:83, defense:80, goalkeeping:81 },
    players: [
      { name: 'Diogo Costa',       position: 'GK' },
      { name: 'João Cancelo',      position: 'RB' },
      { name: 'Rúben Dias',        position: 'CB' },
      { name: 'Pepe',              position: 'CB' },
      { name: 'Raphaël Guerreiro', position: 'LB' },
      { name: 'Vitinha',           position: 'DM' },
      { name: 'Bruno Fernandes',   position: 'CM' },
      { name: 'Bernardo Silva',    position: 'CM' },
      { name: 'Cristiano Ronaldo', position: 'RW' },
      { name: 'Gonçalo Ramos',     position: 'ST' },
      { name: 'Rafael Leão',       position: 'LW' },
    ]
  },

  // ── BELGICA ──────────────────────────────────────────────

  'belgica': {
    aliases: ['belgium','belgium 2018','belgica 2018','generacion dorada belgica','red devils 2018'],
    formation: '4-3-3',
    ratings: { attack:90, midfield:88, defense:84, goalkeeping:81 },
    players: [
      { name: 'Thibaut Courtois',  position: 'GK' },
      { name: 'Toby Alderweireld', position: 'RB' },
      { name: 'Vincent Kompany',   position: 'CB' },
      { name: 'Jan Vertonghen',    position: 'CB' },
      { name: 'Thomas Meunier',    position: 'LB' },
      { name: 'Axel Witsel',       position: 'DM' },
      { name: 'Kevin De Bruyne',   position: 'CM' },
      { name: 'Marouane Fellaini', position: 'CM' },
      { name: 'Eden Hazard',       position: 'LW' },
      { name: 'Romelu Lukaku',     position: 'ST' },
      { name: 'Dries Mertens',     position: 'RW' },
    ]
  },

  // ── ATLETICO MADRID ──────────────────────────────────────

  'atletico madrid 2014': {
    aliases: ['atletico 2014','atletico madrid 2013-14','atletico simeone liga 2014','colchoneros 2014'],
    formation: '4-4-2',
    ratings: { attack:83, midfield:85, defense:93, goalkeeping:87 },
    players: [
      { name: 'Thibaut Courtois',  position: 'GK' },
      { name: 'Juanfran',          position: 'RB' },
      { name: 'Miranda',           position: 'CB' },
      { name: 'Diego Godín',       position: 'CB' },
      { name: 'Filipe Luís',       position: 'LB' },
      { name: 'Gabi',              position: 'DM' },
      { name: 'Tiago',             position: 'CM' },
      { name: 'Arda Turan',        position: 'RM' },
      { name: 'Koke',              position: 'LM' },
      { name: 'Diego Costa',       position: 'ST' },
      { name: 'Adrián López',      position: 'ST' },
    ]
  },

  // ── PSG ──────────────────────────────────────────────────

  'psg 2022': {
    aliases: ['paris saint germain 2022','psg 2021-22','psg messi ronaldo neymar mbappe','psg tres m'],
    formation: '4-3-3',
    ratings: { attack:97, midfield:85, defense:84, goalkeeping:84 },
    players: [
      { name: 'Gianluigi Donnarumma', position: 'GK' },
      { name: 'Achraf Hakimi',     position: 'RB' },
      { name: 'Marquinhos',        position: 'CB' },
      { name: 'Presnel Kimpembe',  position: 'CB' },
      { name: 'Nuno Mendes',       position: 'LB' },
      { name: 'Idrissa Gueye',     position: 'DM' },
      { name: 'Marco Verratti',    position: 'CM' },
      { name: 'Ander Herrera',     position: 'CM' },
      { name: 'Lionel Messi',      position: 'RW' },
      { name: 'Neymar Jr',         position: 'LW' },
      { name: 'Kylian Mbappé',     position: 'ST' },
    ]
  },

  // ── SANTOS ───────────────────────────────────────────────

  'santos 1963': {
    aliases: ['santos fc 1963','santos pele 1963','santos intercontinental 1963'],
    formation: '4-2-4',
    ratings: { attack:93, midfield:85, defense:79, goalkeeping:78 },
    players: [
      { name: 'Gilmar',            position: 'GK' },
      { name: 'Lima',              position: 'RB' },
      { name: 'Dalmo',             position: 'CB' },
      { name: 'Mauro',             position: 'CB' },
      { name: 'Formiga',           position: 'LB' },
      { name: 'Zito',              position: 'DM' },
      { name: 'Mengálvio',         position: 'CM' },
      { name: 'Dorval',            position: 'RW' },
      { name: 'Coutinho',          position: 'AM' },
      { name: 'Pelé',              position: 'ST' },
      { name: 'Pepe',              position: 'LW' },
    ]
  },

  // ── GERMANY / ALEMANIA (extra eras) ──────────────────────

  'germany 1966': {
    aliases: ['alemania 1966','west germany 1966','alemania copa 1966','rfа 1966','germany world cup 1966'],
    formation: '4-3-3',
    ratings: { attack:84, midfield:83, defense:85, goalkeeping:83 },
    players: [
      { name: 'Hans Tilkowski',    position: 'GK' },
      { name: 'Horst-Dieter Höttges', position: 'RB' },
      { name: 'Willi Schulz',      position: 'CB' },
      { name: 'Karl-Heinz Schnellinger', position: 'CB' },
      { name: 'Franz Beckenbauer', position: 'LB' },
      { name: 'Wolfgang Overath',  position: 'DM' },
      { name: 'Helmut Haller',     position: 'CM' },
      { name: 'Siegfried Held',    position: 'RW' },
      { name: 'Uwe Seeler',        position: 'AM' },
      { name: 'Lothar Emmerich',   position: 'LW' },
      { name: 'Gerd Müller',       position: 'ST' },
    ]
  },

  'germany 1990': {
    aliases: ['alemania 1990','west germany 1990','alemania copa 1990','alemania mundial 1990','germany world cup 1990','matthaus 1990'],
    formation: '4-3-3',
    ratings: { attack:88, midfield:89, defense:87, goalkeeping:85 },
    players: [
      { name: 'Bodo Illgner',      position: 'GK' },
      { name: 'Thomas Berthold',   position: 'RB' },
      { name: 'Jürgen Kohler',     position: 'CB' },
      { name: 'Guido Buchwald',    position: 'CB' },
      { name: 'Andreas Brehme',    position: 'LB' },
      { name: 'Lothar Matthäus',   position: 'DM' },
      { name: 'Thomas Häßler',     position: 'CM' },
      { name: 'Pierre Littbarski', position: 'CM' },
      { name: 'Rudi Völler',       position: 'RW' },
      { name: 'Jürgen Klinsmann',  position: 'ST' },
      { name: 'Klaus Augenthaler', position: 'LW' },
    ]
  },

  // ── ARGENTINA (extra eras) ────────────────────────────────

  'argentina 1990': {
    aliases: ['argentina copa 1990','argentina mundial 1990','argentina maradona 1990','argentina italia 90'],
    formation: '3-5-2',
    ratings: { attack:82, midfield:80, defense:79, goalkeeping:81 },
    players: [
      { name: 'Sergio Goycochea',  position: 'GK' },
      { name: 'José Serrizuela',   position: 'RB' },
      { name: 'Roberto Sensini',   position: 'CB' },
      { name: 'Oscar Ruggeri',     position: 'CB' },
      { name: 'Julio Olarticoechea', position: 'LB' },
      { name: 'Juan Simón',        position: 'DM' },
      { name: 'Jorge Burruchaga',  position: 'CM' },
      { name: 'Ricardo Giusti',    position: 'CM' },
      { name: 'Diego Maradona',    position: 'AM' },
      { name: 'Claudio Caniggia',  position: 'ST' },
      { name: 'Abel Balbo',        position: 'ST' },
    ]
  },

  'argentina 2014': {
    aliases: ['argentina copa 2014','argentina mundial 2014','argentina brasil 2014','argentina messi 2014'],
    formation: '4-3-3',
    ratings: { attack:88, midfield:84, defense:83, goalkeeping:82 },
    players: [
      { name: 'Sergio Romero',     position: 'GK' },
      { name: 'Pablo Zabaleta',    position: 'RB' },
      { name: 'Martín Demichelis', position: 'CB' },
      { name: 'Ezequiel Garay',    position: 'CB' },
      { name: 'Marcos Rojo',       position: 'LB' },
      { name: 'Javier Mascherano', position: 'DM' },
      { name: 'Lucas Biglia',      position: 'CM' },
      { name: 'Ángel Di María',    position: 'CM' },
      { name: 'Lionel Messi',      position: 'RW' },
      { name: 'Gonzalo Higuaín',   position: 'ST' },
      { name: 'Sergio Agüero',     position: 'LW' },
    ]
  },

  // ── ITALY / ITALIA (extra eras) ───────────────────────────

  'italy 1978': {
    aliases: ['italia 1978','italy world cup 1978','italia copa 1978','italia mundial 1978'],
    formation: '4-4-2',
    ratings: { attack:82, midfield:84, defense:88, goalkeeping:86 },
    players: [
      { name: 'Dino Zoff',         position: 'GK' },
      { name: 'Claudio Gentile',   position: 'RB' },
      { name: 'Gaetano Scirea',    position: 'CB' },
      { name: 'Marco Tardelli',    position: 'CB' },
      { name: 'Antonio Cabrini',   position: 'LB' },
      { name: 'Gabriele Oriali',   position: 'DM' },
      { name: 'Renato Zaccarelli', position: 'CM' },
      { name: 'Romeo Benetti',     position: 'CM' },
      { name: 'Roberto Bettega',   position: 'RW' },
      { name: 'Paolo Rossi',       position: 'ST' },
      { name: 'Francesco Graziani', position: 'LW' },
    ]
  },

  'italy 1994': {
    aliases: ['italia 1994','italy world cup 1994','italia copa 1994','italia mundial 1994','baggio 1994','italia usa 94'],
    formation: '4-4-2',
    ratings: { attack:84, midfield:83, defense:87, goalkeeping:86 },
    players: [
      { name: 'Gianluca Pagliuca', position: 'GK' },
      { name: 'Mauro Tassotti',    position: 'RB' },
      { name: 'Costacurta',        position: 'CB' },
      { name: 'Franco Baresi',     position: 'CB' },
      { name: 'Paolo Maldini',     position: 'LB' },
      { name: 'Dino Baggio',       position: 'DM' },
      { name: 'Roberto Donadoni',  position: 'CM' },
      { name: 'Demetrio Albertini', position: 'CM' },
      { name: 'Daniele Massaro',   position: 'RW' },
      { name: 'Roberto Baggio',    position: 'AM' },
      { name: 'Pierluigi Casiraghi', position: 'ST' },
    ]
  },

  'italy 2000': {
    aliases: ['italia 2000','italy euro 2000','italia eurocopa 2000','italia holanda 2000','totti 2000'],
    formation: '4-4-2',
    ratings: { attack:85, midfield:84, defense:88, goalkeeping:87 },
    players: [
      { name: 'Francesco Toldo',   position: 'GK' },
      { name: 'Cristian Panucci',  position: 'RB' },
      { name: 'Alessandro Nesta',  position: 'CB' },
      { name: 'Fabio Cannavaro',   position: 'CB' },
      { name: 'Paolo Maldini',     position: 'LB' },
      { name: 'Luigi Di Biagio',   position: 'DM' },
      { name: 'Demetrio Albertini', position: 'CM' },
      { name: 'Gianluca Pessotto', position: 'CM' },
      { name: 'Francesco Totti',   position: 'AM' },
      { name: 'Filippo Inzaghi',   position: 'ST' },
      { name: 'Alessandro Del Piero', position: 'ST' },
    ]
  },

  // ── FRANCE (extra eras) ───────────────────────────────────

  'france 1984': {
    aliases: ['francia 1984','france euro 1984','france eurocopa 1984','platini france 1984','le carre magique 1984'],
    formation: '4-4-2',
    ratings: { attack:90, midfield:91, defense:82, goalkeeping:79 },
    players: [
      { name: 'Joël Bats',         position: 'GK' },
      { name: 'Manuel Amoros',     position: 'RB' },
      { name: 'Maxime Bossis',     position: 'CB' },
      { name: 'Patrick Battiston', position: 'CB' },
      { name: 'Yvon Le Roux',      position: 'LB' },
      { name: 'Jean Tigana',       position: 'DM' },
      { name: 'Luis Fernández',    position: 'CM' },
      { name: 'Alain Giresse',     position: 'CM' },
      { name: 'Michel Platini',    position: 'AM' },
      { name: 'Bruno Bellone',     position: 'ST' },
      { name: 'Yannick Stopyra',   position: 'ST' },
    ]
  },

  'france 2000': {
    aliases: ['francia 2000','france euro 2000','france eurocopa 2000','france campeona 2000','zidane france 2000'],
    formation: '4-2-3-1',
    ratings: { attack:89, midfield:90, defense:87, goalkeeping:87 },
    players: [
      { name: 'Fabien Barthez',    position: 'GK' },
      { name: 'Lilian Thuram',     position: 'RB' },
      { name: 'Marcel Desailly',   position: 'CB' },
      { name: 'Frank Leboeuf',     position: 'CB' },
      { name: 'Bixente Lizarazu',  position: 'LB' },
      { name: 'Emmanuel Petit',    position: 'DM' },
      { name: 'Didier Deschamps',  position: 'CM' },
      { name: 'Robert Pires',      position: 'RW' },
      { name: 'Zinedine Zidane',   position: 'AM' },
      { name: 'David Trezeguet',   position: 'ST' },
      { name: 'Thierry Henry',     position: 'LW' },
    ]
  },

  // ── NETHERLANDS / HOLANDA (extra eras) ───────────────────

  'netherlands 2010': {
    aliases: ['holanda 2010','netherlands world cup 2010','holanda copa 2010','holanda mundial 2010','holanda sudafrica 2010','holland 2010'],
    formation: '4-3-3',
    ratings: { attack:88, midfield:87, defense:83, goalkeeping:82 },
    players: [
      { name: 'Maarten Stekelenburg', position: 'GK' },
      { name: 'Gregory van der Wiel', position: 'RB' },
      { name: 'John Heitinga',     position: 'CB' },
      { name: 'Joris Mathijsen',   position: 'CB' },
      { name: 'Giovanni van Bronckhorst', position: 'LB' },
      { name: 'Mark van Bommel',   position: 'DM' },
      { name: 'Nigel de Jong',     position: 'CM' },
      { name: 'Wesley Sneijder',   position: 'AM' },
      { name: 'Arjen Robben',      position: 'RW' },
      { name: 'Dirk Kuyt',         position: 'ST' },
      { name: 'Robin van Persie',  position: 'LW' },
    ]
  },

  // ── BRAZIL (extra eras) ───────────────────────────────────

  'brasil 1962': {
    aliases: ['brazil 1962','brasil copa 1962','brasil mundial 1962','garrincha 1962','brasil chile 62'],
    formation: '4-2-4',
    ratings: { attack:92, midfield:84, defense:79, goalkeeping:76 },
    players: [
      { name: 'Gilmar',            position: 'GK' },
      { name: 'Djalma Santos',     position: 'RB' },
      { name: 'Mauro',             position: 'CB' },
      { name: 'Zózimo',            position: 'CB' },
      { name: 'Nilton Santos',     position: 'LB' },
      { name: 'Zito',              position: 'DM' },
      { name: 'Didi',              position: 'CM' },
      { name: 'Garrincha',         position: 'RW' },
      { name: 'Vavá',              position: 'AM' },
      { name: 'Amarildo',          position: 'ST' },
      { name: 'Zagallo',           position: 'LW' },
    ]
  },

  'brasil 1998': {
    aliases: ['brazil 1998','brasil copa 1998','brasil mundial 1998','brasil ronaldo 1998','brasil franca 1998'],
    formation: '4-4-2',
    ratings: { attack:88, midfield:85, defense:82, goalkeeping:84 },
    players: [
      { name: 'Taffarel',          position: 'GK' },
      { name: 'Cafu',              position: 'RB' },
      { name: 'Aldair',            position: 'CB' },
      { name: 'Junior Baiano',     position: 'CB' },
      { name: 'Roberto Carlos',    position: 'LB' },
      { name: 'César Sampaio',     position: 'DM' },
      { name: 'Emerson',           position: 'CM' },
      { name: 'Rivaldo',           position: 'AM' },
      { name: 'Leonardo',          position: 'LW' },
      { name: 'Ronaldo',           position: 'ST' },
      { name: 'Bebeto',            position: 'RW' },
    ]
  },

  'brasil 2006': {
    aliases: ['brazil 2006','brasil copa 2006','brasil mundial 2006','brasil ronaldinho 2006','brasil alemania 2006'],
    formation: '4-3-3',
    ratings: { attack:91, midfield:89, defense:81, goalkeeping:82 },
    players: [
      { name: 'Dida',              position: 'GK' },
      { name: 'Cafu',              position: 'RB' },
      { name: 'Lúcio',             position: 'CB' },
      { name: 'Juan',              position: 'CB' },
      { name: 'Roberto Carlos',    position: 'LB' },
      { name: 'Gilberto Silva',    position: 'DM' },
      { name: 'Kaká',              position: 'CM' },
      { name: 'Juninho Pernambucano', position: 'CM' },
      { name: 'Ronaldinho',        position: 'RW' },
      { name: 'Ronaldo Nazário',   position: 'ST' },
      { name: 'Adriano',           position: 'LW' },
    ]
  },

  // ── ENGLAND (extra eras) ──────────────────────────────────

  'england 1990': {
    aliases: ['inglaterra 1990','england world cup 1990','england italia 90','gascoigne england 1990'],
    formation: '4-4-2',
    ratings: { attack:82, midfield:83, defense:84, goalkeeping:83 },
    players: [
      { name: 'Peter Shilton',     position: 'GK' },
      { name: 'Paul Parker',       position: 'RB' },
      { name: 'Terry Butcher',     position: 'CB' },
      { name: 'Mark Wright',       position: 'CB' },
      { name: 'Stuart Pearce',     position: 'LB' },
      { name: 'Steve McMahon',     position: 'DM' },
      { name: 'Paul Gascoigne',    position: 'CM' },
      { name: 'David Platt',       position: 'CM' },
      { name: 'Chris Waddle',      position: 'RW' },
      { name: 'Gary Lineker',      position: 'ST' },
      { name: 'Peter Beardsley',   position: 'LW' },
    ]
  },

  'england 1996': {
    aliases: ['inglaterra 1996','england euro 1996','england eurocopa 1996','three lions 1996','shearer england 1996'],
    formation: '4-4-2',
    ratings: { attack:84, midfield:83, defense:83, goalkeeping:84 },
    players: [
      { name: 'David Seaman',      position: 'GK' },
      { name: 'Gary Neville',      position: 'RB' },
      { name: 'Tony Adams',        position: 'CB' },
      { name: 'Gareth Southgate',  position: 'CB' },
      { name: 'Stuart Pearce',     position: 'LB' },
      { name: 'Paul Ince',         position: 'DM' },
      { name: 'Paul Gascoigne',    position: 'CM' },
      { name: 'Steve McManaman',   position: 'RW' },
      { name: 'Darren Anderton',   position: 'AM' },
      { name: 'Alan Shearer',      position: 'ST' },
      { name: 'Teddy Sheringham',  position: 'LW' },
    ]
  },

  // ── PORTUGAL (extra eras) ─────────────────────────────────

  'portugal 1966': {
    aliases: ['portugal copa 1966','portugal world cup 1966','portugal eusebio 1966','eusebio portugal 1966'],
    formation: '4-3-3',
    ratings: { attack:89, midfield:84, defense:81, goalkeeping:79 },
    players: [
      { name: 'José Pereira',      position: 'GK' },
      { name: 'João Morais',       position: 'RB' },
      { name: 'Vicente',           position: 'CB' },
      { name: 'Alexandre Baptista', position: 'CB' },
      { name: 'Hilário',           position: 'LB' },
      { name: 'Mário Coluna',      position: 'DM' },
      { name: 'Jaime Graça',       position: 'CM' },
      { name: 'José Augusto',      position: 'RW' },
      { name: 'António Simões',    position: 'AM' },
      { name: 'Eusébio',           position: 'ST' },
      { name: 'Torres',            position: 'LW' },
    ]
  },

  'portugal 2004': {
    aliases: ['portugal euro 2004','portugal eurocopa 2004','portugal figo 2004','portugal final 2004'],
    formation: '4-4-2',
    ratings: { attack:84, midfield:86, defense:84, goalkeeping:83 },
    players: [
      { name: 'Ricardo',           position: 'GK' },
      { name: 'Miguel',            position: 'RB' },
      { name: 'Fernando Couto',    position: 'CB' },
      { name: 'Jorge Andrade',     position: 'CB' },
      { name: 'Nuno Valente',      position: 'LB' },
      { name: 'Costinha',          position: 'DM' },
      { name: 'Maniche',           position: 'CM' },
      { name: 'Luís Figo',         position: 'RW' },
      { name: 'Deco',              position: 'AM' },
      { name: 'Pauleta',           position: 'ST' },
      { name: 'Cristiano Ronaldo', position: 'LW' },
    ]
  },

  // ── SPAIN / ESPAÑA (extra eras) ───────────────────────────

  'spain 2006': {
    aliases: ['españa 2006','spain world cup 2006','españa copa 2006','españa villa 2006'],
    formation: '4-4-2',
    ratings: { attack:84, midfield:83, defense:82, goalkeeping:82 },
    players: [
      { name: 'Iker Casillas',     position: 'GK' },
      { name: 'Michel Salgado',    position: 'RB' },
      { name: 'Carles Puyol',      position: 'CB' },
      { name: 'Sergio Ramos',      position: 'CB' },
      { name: 'Álvaro Arbeloa',    position: 'LB' },
      { name: 'Xabi Alonso',       position: 'DM' },
      { name: 'Marcos Senna',      position: 'CM' },
      { name: 'Joaquín',           position: 'RW' },
      { name: 'Cesc Fàbregas',     position: 'AM' },
      { name: 'David Villa',       position: 'ST' },
      { name: 'Fernando Torres',   position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  CAMPEONES DEL MUNDO — eras no cubiertas
  // ══════════════════════════════════════════════════════════

  // ── URUGUAY ──────────────────────────────────────────────

  'uruguay 1930': {
    aliases: ['uruguay copa 1930','uruguay mundial 1930','uruguay campeón 1930','uruguay primer mundial','nasazzi 1930'],
    formation: '2-3-5',
    ratings: { attack:87, midfield:82, defense:79, goalkeeping:78 },
    players: [
      { name: 'Enrique Ballestrero', position: 'GK' },
      { name: 'José Nasazzi',        position: 'CB' },
      { name: 'Ernesto Mascheroni',  position: 'CB' },
      { name: 'José Andrade',        position: 'DM' },
      { name: 'Álvaro Gestido',      position: 'CM' },
      { name: 'Lorenzo Fernández',   position: 'CM' },
      { name: 'Pablo Dorado',        position: 'RW' },
      { name: 'Héctor Scarone',      position: 'AM' },
      { name: 'Pedro Petrone',       position: 'ST' },
      { name: 'Héctor Castro',       position: 'ST' },
      { name: 'Santos Iriarte',      position: 'LW' },
    ]
  },

  'uruguay 1950': {
    aliases: ['uruguay copa 1950','uruguay mundial 1950','uruguay maracanazo','uruguay schiaffino 1950','ghiggia 1950'],
    formation: '4-4-2',
    ratings: { attack:89, midfield:84, defense:82, goalkeeping:83 },
    players: [
      { name: 'Roque Máspoli',            position: 'GK' },
      { name: 'Matías González',          position: 'RB' },
      { name: 'Obdulio Varela',           position: 'CB' },
      { name: 'Eusebio Tejera',           position: 'LB' },
      { name: 'Víctor Rodríguez Andrade', position: 'DM' },
      { name: 'Julio Pérez',              position: 'CM' },
      { name: 'Alcides Ghiggia',          position: 'RW' },
      { name: 'Juan Schiaffino',          position: 'AM' },
      { name: 'Óscar Míguez',             position: 'ST' },
      { name: 'Omar Méndez',              position: 'LM' },
      { name: 'Rubén Morán',              position: 'LW' },
    ]
  },

  // ── ITALY / ITALIA (copas del mundo 1934 y 1938) ─────────

  'italia 1934': {
    aliases: ['italy 1934','italy 1938','italia 1938','italia pozzo 1934','italia pozzo 1938',
              'italy world cup 1934','italy world cup 1938','meazza 1934','meazza 1938'],
    formation: '3-2-5',
    ratings: { attack:87, midfield:83, defense:82, goalkeeping:82 },
    players: [
      { name: 'Giampiero Combi',    position: 'GK' },
      { name: 'Eraldo Monzeglio',   position: 'RB' },
      { name: 'Luigi Allemandi',    position: 'LB' },
      { name: 'Attilio Ferraris',   position: 'CB' },
      { name: 'Luigi Bertolini',    position: 'DM' },
      { name: 'Giovanni Ferrari',   position: 'CM' },
      { name: 'Enrique Guaita',     position: 'RW' },
      { name: 'Giuseppe Meazza',    position: 'AM' },
      { name: 'Angelo Schiavio',    position: 'ST' },
      { name: 'Raimundo Orsi',      position: 'LW' },
      { name: 'Pietro Rava',        position: 'CB' },
    ]
  },

  // ── WEST GERMANY 1954 ────────────────────────────────────

  'alemania 1954': {
    aliases: ['germany 1954','west germany 1954','alemania oeste 1954','germany world cup 1954',
              'miracle of bern','milagro de berna','fritz walter 1954','rahn 1954'],
    formation: '4-2-4',
    ratings: { attack:88, midfield:83, defense:82, goalkeeping:84 },
    players: [
      { name: 'Toni Turek',         position: 'GK' },
      { name: 'Josef Posipal',      position: 'RB' },
      { name: 'Werner Liebrich',    position: 'CB' },
      { name: 'Anton Schäfer',      position: 'LB' },
      { name: 'Karl Mai',           position: 'DM' },
      { name: 'Fritz Walter',       position: 'CM' },
      { name: 'Helmut Rahn',        position: 'RW' },
      { name: 'Ottmar Walter',      position: 'AM' },
      { name: 'Max Morlock',        position: 'ST' },
      { name: 'Hans Schäfer',       position: 'LW' },
      { name: 'Bernhard Klodt',     position: 'RM' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  CAMPEONES DE EUROCOPA — eras no cubiertas
  // ══════════════════════════════════════════════════════════

  // ── SOVIET UNION / URSS 1960 ─────────────────────────────

  'urss 1960': {
    aliases: ['soviet union 1960','soviet 1960','ussr 1960','urss eurocopa 1960',
              'urss euro 1960','yashin 1960','cccp 1960'],
    formation: '4-3-3',
    ratings: { attack:85, midfield:83, defense:82, goalkeeping:90 },
    players: [
      { name: 'Lev Yashin',         position: 'GK' },
      { name: 'Givi Chokheli',      position: 'RB' },
      { name: 'Anatoly Maslenkin',  position: 'CB' },
      { name: 'Yuri Voinov',        position: 'CB' },
      { name: 'Yuri Kuznetsov',     position: 'LB' },
      { name: 'Igor Netto',         position: 'DM' },
      { name: 'Valentin Ivanov',    position: 'CM' },
      { name: 'Slava Metreveli',    position: 'RW' },
      { name: 'Aleksei Mamykin',    position: 'AM' },
      { name: 'Viktor Ponedelnik',  position: 'ST' },
      { name: 'Mikhail Meskhi',     position: 'LW' },
    ]
  },

  // ── SPAIN / ESPAÑA 1964 ──────────────────────────────────

  'españa 1964': {
    aliases: ['spain 1964','spain euro 1964','españa eurocopa 1964',
              'spain european championship 1964','marcelino 1964'],
    formation: '4-3-3',
    ratings: { attack:83, midfield:82, defense:80, goalkeeping:80 },
    players: [
      { name: 'José Angúlo Iribar', position: 'GK' },
      { name: 'Carlos Lapetra',     position: 'RB' },
      { name: 'Zoco',               position: 'CB' },
      { name: 'Reija',              position: 'CB' },
      { name: 'Germán',             position: 'LB' },
      { name: 'Luis Del Sol',       position: 'DM' },
      { name: 'Amancio Amaro',      position: 'CM' },
      { name: 'Adelardo',           position: 'RW' },
      { name: 'Pereda',             position: 'AM' },
      { name: 'Marcelino Martínez', position: 'ST' },
      { name: 'Collar',             position: 'LW' },
    ]
  },

  // ── ITALY / ITALIA 1968 ──────────────────────────────────

  'italia 1968': {
    aliases: ['italy 1968','italy euro 1968','italia eurocopa 1968',
              'italy european championship 1968','anastasi 1968','riva 1968'],
    formation: '4-3-3',
    ratings: { attack:84, midfield:82, defense:84, goalkeeping:83 },
    players: [
      { name: 'Dino Zoff',          position: 'GK' },
      { name: 'Tarcisio Burgnich',  position: 'RB' },
      { name: 'Armando Picchi',     position: 'CB' },
      { name: 'Giancarlo Bertini',  position: 'CB' },
      { name: 'Giacinto Facchetti', position: 'LB' },
      { name: 'Sandro Mazzola',     position: 'DM' },
      { name: 'Gigi De Sisti',      position: 'CM' },
      { name: 'Angelo Domenghini',  position: 'RW' },
      { name: 'Gianni Rivera',      position: 'AM' },
      { name: 'Pietro Anastasi',    position: 'ST' },
      { name: 'Luigi Riva',         position: 'LW' },
    ]
  },

  // ── WEST GERMANY / ALEMANIA 1972 ─────────────────────────

  'alemania 1972': {
    aliases: ['germany 1972','west germany 1972','germany euro 1972','alemania eurocopa 1972',
              'alemania oeste 1972','netzer 1972','beckenbauer euro 1972'],
    formation: '4-3-3',
    ratings: { attack:90, midfield:87, defense:85, goalkeeping:86 },
    players: [
      { name: 'Sepp Maier',           position: 'GK' },
      { name: 'Berti Vogts',          position: 'RB' },
      { name: 'Georg Schwarzenbeck',  position: 'CB' },
      { name: 'Franz Beckenbauer',    position: 'CB' },
      { name: 'Paul Breitner',        position: 'LB' },
      { name: 'Herbert Wimmer',       position: 'DM' },
      { name: 'Günter Netzer',        position: 'CM' },
      { name: 'Uli Hoeneß',           position: 'RW' },
      { name: 'Jupp Heynckes',        position: 'AM' },
      { name: 'Gerd Müller',          position: 'ST' },
      { name: 'Erwin Kremers',        position: 'LW' },
    ]
  },

  // ── CZECHOSLOVAKIA 1976 ──────────────────────────────────

  'checoslovaquia 1976': {
    aliases: ['czechoslovakia 1976','czechoslovakia euro 1976','checoslovaquia eurocopa 1976',
              'panenka 1976','czech 1976','nehoda 1976'],
    formation: '4-4-2',
    ratings: { attack:84, midfield:84, defense:83, goalkeeping:82 },
    players: [
      { name: 'Ivo Viktor',         position: 'GK' },
      { name: 'Karol Dobiáš',       position: 'RB' },
      { name: 'Ján Pivarník',       position: 'CB' },
      { name: 'Anton Ondruš',       position: 'CB' },
      { name: 'Koloman Gögh',       position: 'LB' },
      { name: 'Antonín Panenka',    position: 'DM' },
      { name: 'Jozef Moder',        position: 'CM' },
      { name: 'Ladislav Jurkemik',  position: 'RW' },
      { name: 'Zdeněk Nehoda',      position: 'AM' },
      { name: 'Marián Masný',       position: 'LW' },
      { name: 'Dušan Gallis',       position: 'ST' },
    ]
  },

  // ── WEST GERMANY / ALEMANIA 1980 ─────────────────────────

  'alemania 1980': {
    aliases: ['germany 1980','west germany 1980','germany euro 1980','alemania eurocopa 1980',
              'alemania oeste 1980','hrubesch 1980','rummenigge euro 1980'],
    formation: '4-4-2',
    ratings: { attack:86, midfield:85, defense:85, goalkeeping:84 },
    players: [
      { name: 'Harald Schumacher',     position: 'GK' },
      { name: 'Manny Kaltz',           position: 'RB' },
      { name: 'Karl-Heinz Förster',    position: 'CB' },
      { name: 'Bernard Dietz',         position: 'CB' },
      { name: 'Hans-Hubert Bonhof',    position: 'LB' },
      { name: 'Heinz Flohe',           position: 'DM' },
      { name: 'Hansi Müller',          position: 'CM' },
      { name: 'Klaus Allofs',          position: 'RW' },
      { name: 'Karl-Heinz Rummenigge', position: 'AM' },
      { name: 'Horst Hrubesch',        position: 'ST' },
      { name: 'Bernd Schuster',        position: 'LW' },
    ]
  },

  // ── DENMARK / DINAMARCA 1992 ─────────────────────────────

  'dinamarca 1992': {
    aliases: ['denmark 1992','denmark euro 1992','dinamarca eurocopa 1992',
              'schmeichel 1992','laudrup 1992','jensen 1992'],
    formation: '4-4-2',
    ratings: { attack:82, midfield:83, defense:82, goalkeeping:87 },
    players: [
      { name: 'Peter Schmeichel',  position: 'GK' },
      { name: 'John Sivebaek',     position: 'RB' },
      { name: 'Lars Olsen',        position: 'CB' },
      { name: 'Kent Nielsen',      position: 'CB' },
      { name: 'Henrik Andersen',   position: 'LB' },
      { name: 'Kim Christofte',    position: 'DM' },
      { name: 'John Jensen',       position: 'CM' },
      { name: 'Brian Laudrup',     position: 'RW' },
      { name: 'Michael Laudrup',   position: 'AM' },
      { name: 'Flemming Povlsen',  position: 'ST' },
      { name: 'Henrik Larsen',     position: 'LW' },
    ]
  },

  // ── GERMANY / ALEMANIA 1996 ──────────────────────────────

  'alemania 1996': {
    aliases: ['germany 1996','germany euro 1996','germany european championship 1996',
              'alemania eurocopa 1996','bierhoff 1996','klinsmann 1996','sammer 1996'],
    formation: '4-3-3',
    ratings: { attack:85, midfield:86, defense:85, goalkeeping:85 },
    players: [
      { name: 'Andreas Köpke',      position: 'GK' },
      { name: 'Markus Babbel',      position: 'RB' },
      { name: 'Thomas Helmer',      position: 'CB' },
      { name: 'Jürgen Kohler',      position: 'CB' },
      { name: 'Christian Ziege',    position: 'LB' },
      { name: 'Matthias Sammer',    position: 'DM' },
      { name: 'Dieter Eilts',       position: 'CM' },
      { name: 'Thomas Häßler',      position: 'CM' },
      { name: 'Mehmet Scholl',      position: 'RW' },
      { name: 'Oliver Bierhoff',    position: 'ST' },
      { name: 'Jürgen Klinsmann',   position: 'LW' },
    ]
  },

  // ── GREECE / GRECIA 2004 ─────────────────────────────────

  'grecia 2004': {
    aliases: ['greece 2004','greece euro 2004','grecia eurocopa 2004',
              'greece european championship 2004','charisteas 2004','zagorakis 2004'],
    formation: '4-4-2',
    ratings: { attack:75, midfield:76, defense:82, goalkeeping:80 },
    players: [
      { name: 'Antonios Nikopolidis',  position: 'GK' },
      { name: 'Giourkas Seitaridis',   position: 'RB' },
      { name: 'Traianos Dellas',       position: 'CB' },
      { name: 'Michalis Kapsis',       position: 'CB' },
      { name: 'Takis Fyssas',          position: 'LB' },
      { name: 'Theodoros Zagorakis',   position: 'DM' },
      { name: 'Costas Katsouranis',    position: 'CM' },
      { name: 'Giorgos Karagounis',    position: 'CM' },
      { name: 'Angelos Basinas',       position: 'RW' },
      { name: 'Angelos Charisteas',    position: 'ST' },
      { name: 'Stylianos Giannakopoulos', position: 'LW' },
    ]
  },

  // ── ITALY / ITALIA EURO 2021 ─────────────────────────────

  'italia 2021': {
    aliases: ['italy 2021','italy euro 2021','italia eurocopa 2021','italy euro 2020',
              'italia euro 2020','italy mancini 2021','donnarumma 2021','chiesa 2021'],
    formation: '4-3-3',
    ratings: { attack:85, midfield:88, defense:86, goalkeeping:88 },
    players: [
      { name: 'Gianluigi Donnarumma', position: 'GK' },
      { name: 'Giovanni Di Lorenzo',  position: 'RB' },
      { name: 'Leonardo Bonucci',     position: 'CB' },
      { name: 'Giorgio Chiellini',    position: 'CB' },
      { name: 'Emerson Palmieri',     position: 'LB' },
      { name: 'Jorginho',             position: 'DM' },
      { name: 'Marco Verratti',       position: 'CM' },
      { name: 'Nicolo Barella',       position: 'CM' },
      { name: 'Federico Chiesa',      position: 'RW' },
      { name: 'Ciro Immobile',        position: 'ST' },
      { name: 'Lorenzo Insigne',      position: 'LW' },
    ]
  },

  // ── SPAIN / ESPAÑA 2024 ──────────────────────────────────

  'españa 2024': {
    aliases: ['spain 2024','spain euro 2024','españa eurocopa 2024',
              'spain european championship 2024','nico williams 2024','olmo 2024','pedri euro 2024'],
    formation: '4-3-3',
    ratings: { attack:88, midfield:91, defense:84, goalkeeping:82 },
    players: [
      { name: 'Unai Simón',         position: 'GK' },
      { name: 'Dani Carvajal',      position: 'RB' },
      { name: 'Robin Le Normand',   position: 'CB' },
      { name: 'Aymeric Laporte',    position: 'CB' },
      { name: 'Marc Cucurella',     position: 'LB' },
      { name: 'Rodri',              position: 'DM' },
      { name: 'Fabián Ruiz',        position: 'CM' },
      { name: 'Pedri',              position: 'CM' },
      { name: 'Dani Olmo',          position: 'RW' },
      { name: 'Álvaro Morata',      position: 'ST' },
      { name: 'Nico Williams',      position: 'LW' },
    ]
  },

  // ══════════════════════════════════════════════════════════
  //  CAMPEONES COPA DE EUROPA / CHAMPIONS — eras no cubiertas
  // ══════════════════════════════════════════════════════════

  // ── FEYENOORD ────────────────────────────────────────────

  'feyenoord 1970': {
    aliases: ['feyenoord copa europa 1970','feyenoord champions 1970','feyenoord kindvall 1970'],
    formation: '4-2-4',
    ratings: { attack:82, midfield:80, defense:79, goalkeeping:78 },
    players: [
      { name: 'Eddy Treytel',       position: 'GK' },
      { name: 'Rinus Israel',       position: 'RB' },
      { name: 'Theo Laseroms',      position: 'CB' },
      { name: 'Henk Wery',          position: 'LB' },
      { name: 'Wim Jansen',         position: 'DM' },
      { name: 'Wim van Hanegem',    position: 'CM' },
      { name: 'Joop van Daele',     position: 'RW' },
      { name: 'Frans Hasil',        position: 'AM' },
      { name: 'Ove Kindvall',       position: 'ST' },
      { name: 'Coen Moulijn',       position: 'LW' },
      { name: 'Rinus Bennaars',     position: 'CM' },
    ]
  },

  // ── NOTTINGHAM FOREST ────────────────────────────────────

  'nottingham forest 1979': {
    aliases: ['forest 1979','forest 1980','nottingham forest 1980','nottingham forest champions 1979',
              'nottingham forest champions 1980','clough 1979','clough forest'],
    formation: '4-4-2',
    ratings: { attack:82, midfield:82, defense:83, goalkeeping:83 },
    players: [
      { name: 'Peter Shilton',      position: 'GK' },
      { name: 'Viv Anderson',       position: 'RB' },
      { name: 'Larry Lloyd',        position: 'CB' },
      { name: 'Kenny Burns',        position: 'CB' },
      { name: 'Frank Clark',        position: 'LB' },
      { name: 'John McGovern',      position: 'DM' },
      { name: 'Ian Bowyer',         position: 'CM' },
      { name: 'Martin O\'Neill',    position: 'RW' },
      { name: 'Trevor Francis',     position: 'AM' },
      { name: 'Tony Woodcock',      position: 'ST' },
      { name: 'John Robertson',     position: 'LW' },
    ]
  },

  // ── ASTON VILLA ──────────────────────────────────────────

  'aston villa 1982': {
    aliases: ['aston villa champions 1982','aston villa european cup 1982','villa 1982',
              'peter withe 1982','aston villa spink 1982'],
    formation: '4-4-2',
    ratings: { attack:81, midfield:80, defense:80, goalkeeping:79 },
    players: [
      { name: 'Nigel Spink',        position: 'GK' },
      { name: 'Kenny Swain',        position: 'RB' },
      { name: 'Ken McNaught',       position: 'CB' },
      { name: 'Allan Evans',        position: 'CB' },
      { name: 'Colin Gibson',       position: 'LB' },
      { name: 'Dennis Mortimer',    position: 'DM' },
      { name: 'Des Bremner',        position: 'CM' },
      { name: 'Gordon Cowans',      position: 'CM' },
      { name: 'Tony Morley',        position: 'LW' },
      { name: 'Peter Withe',        position: 'ST' },
      { name: 'Gary Shaw',          position: 'RW' },
    ]
  },

  // ── HAMBURG ──────────────────────────────────────────────

  'hamburgo 1983': {
    aliases: ['hamburg 1983','hamburgo sv 1983','hamburg sv 1983','hsv 1983',
              'hamburg champions 1983','felix magath 1983'],
    formation: '4-4-2',
    ratings: { attack:82, midfield:82, defense:81, goalkeeping:80 },
    players: [
      { name: 'Uli Stein',          position: 'GK' },
      { name: 'Manny Kaltz',        position: 'RB' },
      { name: 'Ditmar Jakobs',      position: 'CB' },
      { name: 'Holger Hieronymus',  position: 'CB' },
      { name: 'Thomas von Heesen',  position: 'LB' },
      { name: 'Wolfgang Rolff',     position: 'DM' },
      { name: 'Jimmy Hartwig',      position: 'CM' },
      { name: 'Felix Magath',       position: 'CM' },
      { name: 'Lars Bastrup',       position: 'RW' },
      { name: 'Horst Hrubesch',     position: 'ST' },
      { name: 'Bernd Wehmeyer',     position: 'LW' },
    ]
  },

  // ── STEAUA BUCHAREST ─────────────────────────────────────

  'steaua 1986': {
    aliases: ['steaua bucharest 1986','steaua bucarest 1986','steaua champions 1986',
              'steaua duckadam 1986','steaua rumania 1986','lacatus 1986'],
    formation: '4-4-2',
    ratings: { attack:79, midfield:78, defense:81, goalkeeping:80 },
    players: [
      { name: 'Helmuth Duckadam',   position: 'GK' },
      { name: 'Mihail Majearu',     position: 'RB' },
      { name: 'Stefan Iovan',       position: 'CB' },
      { name: 'Miodrag Belodedici', position: 'CB' },
      { name: 'Tudorel Stoica',     position: 'LB' },
      { name: 'Anton Boloni',       position: 'DM' },
      { name: 'Ştefan Balaci',      position: 'CM' },
      { name: 'Marius Lăcătuș',    position: 'RW' },
      { name: 'Gavril Balint',      position: 'AM' },
      { name: 'Victor Pițurcă',     position: 'ST' },
      { name: 'Rodion Cămataru',    position: 'LW' },
    ]
  },

  // ── PSV EINDHOVEN ────────────────────────────────────────

  'psv 1988': {
    aliases: ['psv eindhoven 1988','psv champions 1988','psv romario 1988',
              'psv copa europa 1988','romario psv 1988'],
    formation: '4-3-3',
    ratings: { attack:84, midfield:82, defense:82, goalkeeping:84 },
    players: [
      { name: 'Hans van Breukelen', position: 'GK' },
      { name: 'Eric Gerets',        position: 'RB' },
      { name: 'Ronald Koeman',      position: 'CB' },
      { name: 'Adri van Tiggelen',  position: 'CB' },
      { name: 'Berry van Aerle',    position: 'LB' },
      { name: 'Sören Lerby',        position: 'DM' },
      { name: 'Gerald Vanenburg',   position: 'CM' },
      { name: 'René van der Gijp',  position: 'RW' },
      { name: 'Eric Koeman',        position: 'LM' },
      { name: 'Romário',            position: 'ST' },
      { name: 'Wim Kieft',          position: 'AM' },
    ]
  },

  // ── RED STAR BELGRADE / ESTRELLA ROJA ────────────────────

  'estrella roja 1991': {
    aliases: ['red star belgrade 1991','red star 1991','estrella roja belgrado 1991',
              'crvena zvezda 1991','prosinecki 1991','savicevic 1991','pancev 1991'],
    formation: '4-4-2',
    ratings: { attack:83, midfield:83, defense:81, goalkeeping:80 },
    players: [
      { name: 'Stevan Stojanović',  position: 'GK' },
      { name: 'Refik Šabanadžović', position: 'RB' },
      { name: 'Slavoljub Muslin',   position: 'CB' },
      { name: 'Miodrag Belodedici', position: 'CB' },
      { name: 'Dragiša Binić',      position: 'LB' },
      { name: 'Siniša Mihajlović',  position: 'DM' },
      { name: 'Robert Prosinečki',  position: 'CM' },
      { name: 'Vladimir Đurović',   position: 'RW' },
      { name: 'Dejan Savićević',    position: 'AM' },
      { name: 'Darko Pančev',       position: 'ST' },
      { name: 'Milko Đurovski',     position: 'LW' },
    ]
  },

  // ── OLYMPIQUE MARSEILLE / MARSELLA ───────────────────────

  'marsella 1993': {
    aliases: ['marseille 1993','olympique marseille 1993','om 1993','marsella champions 1993',
              'boli 1993','deschamps marsella 1993','barthez marsella 1993'],
    formation: '4-4-2',
    ratings: { attack:83, midfield:82, defense:82, goalkeeping:81 },
    players: [
      { name: 'Fabien Barthez',      position: 'GK' },
      { name: 'Franck Sauzée',       position: 'RB' },
      { name: 'Basile Boli',         position: 'CB' },
      { name: 'Marcel Desailly',     position: 'CB' },
      { name: 'Eric Di Meco',        position: 'LB' },
      { name: 'Didier Deschamps',    position: 'DM' },
      { name: 'Jean-Jacques Eydelie',position: 'CM' },
      { name: 'Abedi Pelé',          position: 'RW' },
      { name: 'Rudi Völler',         position: 'AM' },
      { name: 'Alen Bokšić',         position: 'ST' },
      { name: 'Stéphane Paille',     position: 'LW' },
    ]
  },

  // ── BORUSSIA DORTMUND 1997 ───────────────────────────────

  'dortmund 1997': {
    aliases: ['borussia dortmund 1997','bvb 1997','dortmund champions 1997','dortmund ucl 1997',
              'ricken 1997','moller bvb 1997','riedle 1997'],
    formation: '3-4-3',
    ratings: { attack:84, midfield:84, defense:83, goalkeeping:81 },
    players: [
      { name: 'Stefan Klos',          position: 'GK' },
      { name: 'Stefan Reuter',        position: 'RB' },
      { name: 'Júlio César',          position: 'CB' },
      { name: 'Wolfgang Feiersinger', position: 'CB' },
      { name: 'Matthias Sammer',      position: 'DM' },
      { name: 'Andreas Möller',       position: 'CM' },
      { name: 'Paulo Sousa',          position: 'CM' },
      { name: 'Stéphane Chapuisat',   position: 'RW' },
      { name: 'Lars Ricken',          position: 'AM' },
      { name: 'Karl-Heinz Riedle',    position: 'ST' },
      { name: 'Heiko Herrlich',       position: 'LW' },
    ]
  },

  // ── CHELSEA 2021 UCL ─────────────────────────────────────

  'chelsea 2021': {
    aliases: ['chelsea champions 2021','chelsea ucl 2021','chelsea havertz 2021','chelsea tuchel 2021'],
    formation: '3-4-3',
    ratings: { attack:83, midfield:85, defense:85, goalkeeping:85 },
    players: [
      { name: 'Edouard Mendy',      position: 'GK' },
      { name: 'César Azpilicueta',  position: 'RB' },
      { name: 'Thiago Silva',       position: 'CB' },
      { name: 'Antonio Rüdiger',    position: 'CB' },
      { name: 'Ben Chilwell',       position: 'LB' },
      { name: "N'Golo Kanté",       position: 'DM' },
      { name: 'Jorginho',           position: 'CM' },
      { name: 'Mason Mount',        position: 'CM' },
      { name: 'Christian Pulisic',  position: 'RW' },
      { name: 'Kai Havertz',        position: 'ST' },
      { name: 'Timo Werner',        position: 'LW' },
    ]
  },

};

module.exports = { SQUADS };


