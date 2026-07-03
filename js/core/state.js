let canvas = document.getElementById("canvas"); // Elemento canvas del DOM
let ctx = canvas.getContext("2d"); // Contesto di disegno 2D del canvas
let container = document.getElementById("canvas-container"); // Contenitore del canvas

canvas.width = container.offsetWidth; // Larghezza del canvas impostata come la larghezza del suo contenitore
canvas.height = container.offsetHeight; // Altezza del canvas impostata come l'altezza del suo contenitore
let w = canvas.width; // Larghezza del canvas
let h = canvas.height; // Altezza del canvas

const NODE_BASE_HEIGHT_PX = 40; // Altezza base di un nodo in pixel
const NODE_VERTICAL_SPACING_BASE_REL = 0.06; // Spaziatura verticale relativa base tra nodi sequenziali (6% dell'altezza del canvas)
const IF_BRANCH_START_Y_OFFSET_REL = 0.05; // Spaziatura verticale relativa addizionale tra un nodo IF e l'inizio dei suoi rami
const IF_RECONNECT_GAP_REL = 0.04; // Spazio verticale tra il fondo del ramo più lungo e il punto di ricongiunzione
const IF_JOIN_GAP_REL = 0.06; // (legacy) Spazio verticale relativo tra ricongiunzione e nodo successivo all'IF
const IF_JOIN_GAP_PX = 50; // Spazio verticale FISSO (px) tra ricongiunzione e nodo successivo: non scala con l'altezza del canvas
const IF_BRANCH_X_OFFSET_REL = 0.09; // Distanza orizzontale dei rami true/false dal centro dell'IF (dimezzata: archi orizzontali piu corti)

// Ridimensiona il canvas per adattarsi dinamicamente al contenuto dei nodi.
let saved; // Flag per indicare se ci sono modifiche non salvate nel flowchart
// Struttura dati principale per la logica del flowchart
let flow = {
  "nodes": [ 
    { "type": "start", "info": "", "next": "1" },
    { "type": "end", "info": "", "next": null }
  ],
  "variables": [] 
};

let frecceSelected = -1; // Indice della freccia selezionata dall'utente (-1 se nessuna)
let nodoSelected = -1;   // Indice del nodo selezionato dall'utente (-1 se nessuno)

let nodi = []; // Array degli oggetti nodo visuali (per il disegno)
let frecce = []; // Array degli oggetti freccia visuali (per il disegno e l'interazione)

let tabVariabili = document.getElementById("tabVariabili"); // Elemento tabella HTML per le variabili
// Array per la gestione delle righe della tabella (non usato attivamente nel codice fornito)
let rigaTabella = [];
