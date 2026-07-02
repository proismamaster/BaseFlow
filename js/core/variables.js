
  // Gestisce l'aggiunta o la modifica di una variabile nella tabella HTML delle variabili.
  // Viene attivata quando l'utente modifica i campi di input/select in una riga della tabella.
  function aggiungiVaribile(event) {
    let target = event.target; // Elemento che ha scatenato l'evento (input o select)
    while (target && target.tagName !== "TR") target = target.parentElement; 
    if (!target) return; // Esce se non trova la riga

    let isUltimaRiga = (target.rowIndex === tabVariabili.rows.length - 1);
    let val1 = target.cells[0].querySelector("input").value.trim(); 
    let tipo = target.cells[1].querySelector("select").value;    
    let val3 = target.cells[2].querySelector("input").value.trim(); 

    // Rimuove eventuali messaggi di errore visualizzati precedentemente per questa riga
    let oldError = target.nextSibling; // Possibile riga di errore sottostante
    if (oldError && oldError.classList && oldError.classList.contains("error-message-row")) {
      oldError.remove();
    }

    // Se non è l'ultima riga e i campi nome e valore sono entrambi vuoti, interpreta come eliminazione della variabile.
    if (!isUltimaRiga && val1 === "" && val3 === "") {
      flow.variables.splice(target.rowIndex - 1, 1); // Rimuove la variabile dall'array logico (-1 perché l'indice della riga include l'header)
      tabVariabili.deleteRow(target.rowIndex); // Rimuove la riga dalla tabella HTML
      return;
    }

    // Se nome o valore sono vuoti (e non è un'eliminazione), non fa nulla, attende input completo.
    if (val1 === "" || val3 === "") return;

    let fValid = false;
    let valoreConvertito; 
    let errMsg = ""; 
    if (lettereENumeri(val1)) { 
      switch (tipo) { 
        case "int":
          if (/^-?\d+$/.test(val3)) { fValid = true; valoreConvertito = parseInt(val3); } // Valido intero
          else { errMsg = "Il valore deve essere un intero valido."; }
          break;
        case "float":
          if (/^-?\d*\.\d+$/.test(val3) || /^-?\d+\.?\d*$/.test(val3)) { fValid = true; valoreConvertito = parseFloat(val3); } // Valido float
          else { errMsg = "Il valore deve essere un numero decimale valido."; }
          break;
        case "string":
          fValid = true; valoreConvertito = val3; // Le stringhe sono sempre valide (se non vuote, gestito sopra)
          break;
      }
    } else {
      errMsg = "Nome variabile non valido (deve iniziare con una lettera e contenere solo lettere e numeri).";
    }

    // Se i dati sono validi, aggiorna o aggiunge la variabile logica e gestisce la tabella.
    if (fValid) {
      if (!isUltimaRiga) { // Modifica di una variabile esistente
        flow.variables[target.rowIndex - 1] = { name: val1, type: tipo, value: valoreConvertito };
      } else { // Aggiunta di una nuova variabile (era l'ultima riga, quella vuota)
        if (target.getAttribute("data-inserito") === "1") return; 
        target.setAttribute("data-inserito", "1"); // Marca temporaneamente come inserito
        flow.variables.push({ name: val1, type: tipo, value: valoreConvertito }); // Aggiunge all'array logico
        inserisciRiga(); // Aggiunge una nuova riga vuota in fondo alla tabella per il prossimo input
        // Associa l'handler eventi alla nuova ultima riga (quella appena aggiunta)
        tabVariabili.rows[tabVariabili.rows.length - 1].addEventListener("change", aggiungiVaribile);
        target.removeAttribute("data-inserito"); // Rimuove il marcatore
      }

    } else {
      let errorRow = tabVariabili.insertRow(target.rowIndex + 1); // Inserisce una nuova riga per l'errore
      errorRow.classList.add("error-message-row"); // Classe per lo stile
      let errorCell = errorRow.insertCell(); // Cella che occupa tutta la larghezza
      errorCell.colSpan = 3; // Occupa 3 colonne
      errorCell.className = "error-message"; // Classe per lo stile del messaggio
      errorCell.textContent = "Dati non validi. " + errMsg; // Testo dell'errore
      // Rimuove il messaggio di errore al prossimo input nella riga problematica
      target.addEventListener("input", () => { if (errorRow.parentNode) errorRow.remove(); }, { once: true });
    }
  }

  // Inserisce una nuova riga vuota (con campi input e select) nella tabella delle variabili HTML.
  function inserisciRiga() {
    let nuovaRiga = tabVariabili.insertRow(); // Crea un nuovo elemento TR
    let cell1 = nuovaRiga.insertCell(); // Cella per il nome
    let cell2 = nuovaRiga.insertCell(); // Cella per il tipo
    let cell3 = nuovaRiga.insertCell(); // Cella per il valore

    // Input per il nome della variabile
    let inputNome = document.createElement("input");
    inputNome.type = "text"; inputNome.classList.add("inputVariable");
    cell1.appendChild(inputNome);

    // Select per il tipo di variabile
    let selectTipo = document.createElement("select");
    selectTipo.classList.add("inputVariable");
    ["int", "float", "string"].forEach(val => {
      let option = document.createElement("option");
      option.value = val; option.textContent = val.charAt(0).toUpperCase() + val.slice(1);
      if(val=="int"){ // Personalizzazione testo per "Integer"
        option.textContent = "Integer"
      }
      selectTipo.appendChild(option);
    });
    cell2.appendChild(selectTipo);

    // Input per il valore della variabile
    let inputValore = document.createElement("input");
    inputValore.type = "text"; inputValore.classList.add("inputVariable");
    cell3.appendChild(inputValore);
  }
