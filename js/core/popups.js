
// Nasconde la finestra popup utilizzata per selezionare il tipo di nodo da inserire.
function chiudiPopup() {
  document.getElementById("popup-window").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");
}

  // Salva le informazioni inserite nel popup di modifica del nodo
  function salvaInfo() {
    if (nodoSelected !== -1 && flow.nodes[nodoSelected]) { // Assicura che un nodo sia selezionato
        flow.nodes[nodoSelected].info = document.getElementById("edit-node-input").value; 
    }
    chiudiEditPopup(); // Chiude il popup di modifica
    draw(nodi); // Ridisegna il flowchart
  }



  // Nasconde il popup utilizzato per modificare le informazioni di un nodo esistente.
  function chiudiEditPopup() {
    document.getElementById("edit-node-popup").classList.remove("active");
    document.getElementById("overlay").classList.remove("active");
  }

   // Apre il popup per il salvataggio del file del flowchart.
   function saveFile(){
    document.getElementById("save-popup").classList ="active"; // Mostra il popup di salvataggio
    document.getElementById('overlay').classList = 'active'; // Attiva l'overlay
  }

  // Chiude il popup di salvataggio.
  function closeSavePopup(){
   document.getElementById("save-popup").classList.remove('active');
   document.getElementById("overlay").classList.remove('active');
  }
