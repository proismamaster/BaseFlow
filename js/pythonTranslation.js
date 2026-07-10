let tabsCount = 0;
let codeLines = [];
const indend = '    ';
let index=0;
function addLine(code){
    codeLines.push(indend.repeat(tabsCount) + code);
}

// Nota: le funzioni UI del vecchio popup dedicato (openPythonPopup/closePythonPopup/
// copyPythonCode/downloadPythonCode, che puntavano a #python-popup/#python-code)
// sono state rimosse: l'export Python passa ora dal popup unificato
// js/exportUnified.js, che chiama direttamente translateFlow() qui sotto e legge
// 'codeLines'. Questo file resta il motore di traduzione, invariato.

function translateFlow(){
    codeLines = [];
    tabsCount = 0;
    index=0;
    for (index = 0; index < flow.variables.length; index++) {
        addLine(translateVariable(flow.variables[index].name, flow.variables[index].value));
    }
    addLine('\n');
    for (index = 0; index < flow.nodes.length; index++) {
        const node = flow.nodes[index];
        addLine(translateNode(node));
    }
    console.log(codeLines.join('\n'));
}

function translateVariable(variable,init){
    let string = '';
    string += variable + " = " + init;

    return string;
}

function translateNode(node){
    switch(node.type) {
        case 'start':
            return '';
        case 'end':
            return '';
        case 'assign':
            if(node.info == ""){
                codeLines[0] = ("Error: node " + node.type + " is empty. Please edit its informations to translate the chart into Python");
                return '';
            }
            return node.info;
        case 'input':
            if(node.info == ""){
                codeLines[0] = ("Error: node " + node.type + " is empty. Please edit its informations to translate the chart into Python");
                return '';
            }
            const variable = getVariable(node.info,flow.variables);
            switch(variable.type) {
                case 'string':
                    return variable.name + " = input('Insert a string for " + variable.name +"')";
                case 'int':
                    return variable.name + " = int(input('Insert an integer for " + variable.name + "'))";
                case 'float':
                    return variable.name + " = float(input('Insert a float for " + variable.name + "'))";
            }
        case 'print':
            if(node.info == ""){
                codeLines[0] = "Error: node " + node.type + " is empty. Please edit its informations to translate the chart into Python";
                return '';
            }
            return 'print(' + node.info + ')';
        case 'if':
            if(node.info == ""){
                codeLines[0] = ("Error: node " + node.type + " is empty. Please edit its informations to translate the chart into Python");
                return '';
            }
            addLine('');
            addLine('if ' + node.info + ':');
            tabsCount++;
            recreateIfBranches(node);
            return '';
        case 'while':
            if(node.info == ""){
                codeLines[0] = ("Error: node " + node.type + " is empty. Please edit its informations to translate the chart into Python");
                return '';
            }
            addLine('');
            addLine('while ' + node.info + ':');
            tabsCount++;
            recreateWhileBody(node);
            return '';
        case 'for':
            // FIX B1 (review Fable, 2026-07-05, piano Do-While/For): Python non ha un
            // for in stile C (init;condizione;incremento) -- riscrittura STANDARD e
            // documentata (vedi DECISIONS): l'init diventa una riga a se' PRIMA del
            // ciclo (stessa indentazione del for), la condizione diventa un while, e
            // l'incremento va emesso come ULTIMA riga del corpo (dentro il while) --
            // esattamente come un umano tradurrebbe a mano un for C-style in Python.
            if(node.info == ""){
                codeLines[0] = ("Error: node " + node.type + " is empty. Please edit its informations to translate the chart into Python");
                return '';
            }
            const forParts = node.info.split(';');
            if (forParts.length !== 3) {
                codeLines[0] = ("Error: node " + node.type + " has invalid syntax (expected init;condition;increment). Please edit its informations to translate the chart into Python");
                return '';
            }
            const forInit = forParts[0].trim();
            const forCond = forParts[1].trim();
            const forIncr = forParts[2].trim();
            addLine('');
            addLine(forInit);
            addLine('while ' + forCond + ':');
            tabsCount++;
            recreateForBody(node, forIncr);
            return '';
        case 'do':
            // FIX B2 (review Fable, 2026-07-05, piano Do-While/For): Python non ha un
            // do-while nativo -- riscrittura STANDARD e documentata (vedi DECISIONS):
            // while True: <corpo>; if not (<condizione>): break. Questo garantisce
            // l'esecuzione ALMENO una volta, esattamente come il fix semantico
            // dell'executor (B2, vedi execute.js).
            if(node.info == ""){
                codeLines[0] = ("Error: node " + node.type + " is empty. Please edit its informations to translate the chart into Python");
                return '';
            }
            addLine('');
            addLine('while True:');
            tabsCount++;
            recreateDoWhileBody(node);
            return '';
        case 'forward':
        case 'turn':
        case 'home':
        case 'pen':
        case 'gclear':
            return (typeof turtleCommentText === 'function') ? ('# ' + turtleCommentText(node.type, node.info)) : ('# Turtle');
        case 'comment':
            return '# ' + (node.info || '');
        case 'pause':
            return '# [pause]';
    }
}

// Traduce il CORPO di un ciclo While in Python. A differenza di recreateIfBranches
// (che assume range [trueBranch, falseBranch) contigui in flow.nodes, fragile ma
// preesistente e non toccato qui), qui si usa collectLoopBody() -- la stessa
// funzione usata da layout/rendering -- per ottenere l'ordine REALE di esecuzione
// del corpo (robusto anche se gli indici non fossero perfettamente contigui).
// Dopo aver tradotto il corpo, reimposta la variabile 'index' condivisa con
// translateFlow() cosi' che il suo ciclo esterno (index++) riprenda DOPO il corpo,
// senza ritradurre i nodi del corpo come se fossero al livello principale.
function recreateWhileBody(whileNode){
    const loopIdx = flow.nodes.indexOf(whileNode);
    const body = (typeof collectLoopBody === 'function') ? collectLoopBody(loopIdx) : { bodyList: [], exitIndex: null };
    if (body.bodyList.length === 0) {
        // BUG B3 (review Fable, 2026-07-04 notte-2): un while a corpo vuoto emetteva
        // solo "while <cond>:" senza alcuna riga indentata sotto -- Python richiede
        // almeno un'istruzione nel blocco, altrimenti e' un SyntaxError. "pass" e'
        // l'istruzione nulla standard per un blocco intenzionalmente vuoto.
        addLine('pass');
    } else {
        for (const idx of body.bodyList) {
            addLine(translateNode(flow.nodes[idx]));
        }
    }
    tabsCount--;
    index = body.bodyList.length > 0 ? Math.max(...body.bodyList) : loopIdx;
}

// Converte l'espressione di incremento del For (sintassi C-style: i++, i--, i+=n,
// i-=n, i=espressione) nell'equivalente Python. `+=`/`-=`/`=` sono gia' sintassi
// Python valida cosi' come sono scritte -- serve tradurre SOLO i++/i-- (che Python
// non supporta affatto, ne' come ++i ne' come i++).
function translateIncrementToPython(incrExpr){
    const incTrim = incrExpr.trim();
    const incMatch = incTrim.match(/^([a-zA-Z_]\w*)\s*\+\+$/);
    if (incMatch) return incMatch[1] + ' += 1';
    const decMatch = incTrim.match(/^([a-zA-Z_]\w*)\s*--$/);
    if (decMatch) return decMatch[1] + ' -= 1';
    return incTrim;
}

// Traduce il CORPO di un ciclo For in Python (analoga a recreateWhileBody), con
// l'aggiunta dell'incremento come ultima riga del corpo -- e' quello che chiude il
// ciclo in una riscrittura for->while (senza, il while non avanzerebbe mai).
function recreateForBody(forNode, incrExpr){
    const loopIdx = flow.nodes.indexOf(forNode);
    const body = (typeof collectLoopBody === 'function') ? collectLoopBody(loopIdx) : { bodyList: [], exitIndex: null };
    if (body.bodyList.length === 0) {
        addLine('pass');
    } else {
        for (const idx of body.bodyList) {
            addLine(translateNode(flow.nodes[idx]));
        }
    }
    addLine(translateIncrementToPython(incrExpr));
    tabsCount--;
    index = body.bodyList.length > 0 ? Math.max(...body.bodyList) : loopIdx;
}

// Traduce il CORPO di un ciclo Do-While in Python (dentro un `while True:`), con un
// `if not (<condizione>): break` come ultima riga -- pattern standard Python per
// simulare un do-while (garantisce l'esecuzione almeno una volta, poi esce quando
// la condizione e' falsa, esattamente il contrario di un while normale).
function recreateDoWhileBody(doNode){
    const loopIdx = flow.nodes.indexOf(doNode);
    const body = (typeof collectLoopBody === 'function') ? collectLoopBody(loopIdx) : { bodyList: [], exitIndex: null };
    if (body.bodyList.length === 0) {
        addLine('pass');
    } else {
        for (const idx of body.bodyList) {
            addLine(translateNode(flow.nodes[idx]));
        }
    }
    addLine('if not (' + doNode.info + '):');
    tabsCount++;
    addLine('break');
    tabsCount--;
    tabsCount--;
    index = body.bodyList.length > 0 ? Math.max(...body.bodyList) : loopIdx;
}

function recreateIfBranches(ifNode){
    let falseBranch = parseInt(ifNode.next.false);
    let trueBranch = parseInt(ifNode.next.true);
    for(index = trueBranch; index < falseBranch; index++){
        const node = flow.nodes[index];
        addLine(translateNode(node));
    }
    tabsCount--;
    // FIX #14 (Ismail 2026-07-08): in Python "else:" DEVE avere un corpo, altrimenti e'
    // codice non valido (IndentationError). Se il ramo falso e' vuoto (punta direttamente
    // alla ricongiunzione) NON si emette affatto l'else.
    var _ifIdx = flow.nodes.indexOf(ifNode);
    var _sub = (typeof collectBranchNodes === 'function') ? collectBranchNodes(_ifIdx) : null;
    var _hasFalse = _sub ? (_sub.falseList.length > 0) : (falseBranch < (flow.nodes[ifNode.next.false-1] ? flow.nodes[ifNode.next.false-1].next : falseBranch));
    if (_hasFalse) {
        addLine('else:');
        tabsCount++;
        for(index = falseBranch; index < flow.nodes[ifNode.next.false-1].next; index++){
            addLine(translateNode(flow.nodes[index]));
        }
        tabsCount--;
    }
}
