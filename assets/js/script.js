// --- DOM Elements ---
const boardElement = document.getElementById('game-board');
const player1ScoreElement = document.getElementById('player1-score');
const player2ScoreElement = document.getElementById('player2-score');
const player1Card = document.getElementById('player1-score-card');
const player2Card = document.getElementById('player2-score-card');
const player2NameElement = document.getElementById('player2-name');
const turnIndicator = document.getElementById('turn-indicator');
const btnS = document.getElementById('btn-s');
const btnO = document.getElementById('btn-o');
const startGameBtn = document.getElementById('start-game-btn');
const boardSizeInput = document.getElementById('board-size');
const gameModeSelect = document.getElementById('game-mode');
const modal = document.getElementById('game-over-modal');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const modalWinner = document.getElementById('modal-winner');
const modalScore = document.getElementById('modal-score');
const immortalizeBtn = document.getElementById('immortalize-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const irysReceiptElement = document.getElementById('irys-receipt');

// --- Game State ---
let board = [];
let scores = { 1: 0, 2: 0 };
let currentPlayer = 1;
let selectedLetter = 'S';
let boardSize = 7;
let gameMode = 'pvc'; // 'pvp' or 'pvc'
let isComputerThinking = false;

// --- Irys SDK Logic ---

/**
 * Menginisialisasi dan menghubungkan ke Irys menggunakan wallet browser.
 * Untuk pengujian, gunakan "devnet". Untuk rilis, gunakan "mainnet".
 */
const getIrys = async () => {
    if (!window.Irys) {
        throw new Error("Irys Web SDK not found. Please ensure it's loaded.");
    }
    // Gunakan "devnet" untuk pengujian gratis dengan token faucet
    const network = "devnet"; 
    const token = "arweave";

    // Irys SDK akan secara otomatis mencoba terhubung ke wallet yang terpasang (mis. ArConnect)
    const irys = new window.Irys({
        network,
        token,
    });

    // Memastikan wallet terhubung
    await irys.ready();
    console.log("Irys is ready, connected to address:", irys.address);
    return irys;
};


// --- Game Logic ---
const initializeGame = () => {
    boardSize = parseInt(boardSizeInput.value, 10);
    gameMode = gameModeSelect.value;

    if (isNaN(boardSize) || boardSize < 3 || boardSize > 15) {
        alert("Invalid board size. Please choose between 3 and 15.");
        boardSizeInput.value = 7;
        boardSize = 7;
    }
    
    board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    scores = { 1: 0, 2: 0 };
    currentPlayer = 1;
    selectedLetter = 'S';
    isComputerThinking = false;
    
    player2NameElement.textContent = gameMode === 'pvc' ? 'Computer (Pink)' : 'Player 2 (Pink)';
    
    renderBoard();
    updateUI();
    closeModal();
};

const renderBoard = () => {
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            const cell = document.createElement('div');
            cell.classList.add('game-cell', 'w-full', 'h-full', 'bg-slate-700', 'rounded-md', 'flex', 'items-center', 'justify-center', 'text-2xl', 'md:text-3xl', 'font-bold');
            
            if (board[r][c]) {
                cell.textContent = board[r][c].letter;
                cell.classList.add(board[r][c].player === 1 ? 'text-teal-300' : 'text-pink-400', 'no-hover');
            } else {
                 cell.classList.add('cursor-pointer');
                 cell.addEventListener('click', () => handleCellClick(r, c));
            }
            boardElement.appendChild(cell);
        }
    }
};

const updateUI = () => {
    player1ScoreElement.textContent = scores[1];
    player2ScoreElement.textContent = scores[2];
    
    const playerName = currentPlayer === 1 ? 'Player 1' : (gameMode === 'pvc' ? 'Computer' : 'Player 2');
    turnIndicator.textContent = `Turn: ${playerName}`;
    if (isComputerThinking) {
        turnIndicator.textContent = 'Computer is thinking...';
        turnIndicator.classList.add('thinking-indicator');
    } else {
        turnIndicator.classList.remove('thinking-indicator');
    }
    
    if (currentPlayer === 1) {
        player1Card.classList.add('border-teal-500', 'bg-teal-500/20');
        player1Card.classList.remove('border-slate-600', 'bg-slate-500/10');
        player2Card.classList.add('border-slate-600', 'bg-slate-500/10');
        player2Card.classList.remove('border-pink-500', 'bg-pink-500/20');
    } else {
        player2Card.classList.add('border-pink-500', 'bg-pink-500/20');
        player2Card.classList.remove('border-slate-600', 'bg-slate-500/10');
        player1Card.classList.add('border-slate-600', 'bg-slate-500/10');
        player1Card.classList.remove('border-teal-500', 'bg-teal-500/20');
    }

    btnS.classList.toggle('active', selectedLetter === 'S');
    btnS.classList.toggle('bg-teal-500', selectedLetter === 'S');
    btnO.classList.toggle('active', selectedLetter === 'O');
    btnO.classList.toggle('bg-teal-500', selectedLetter === 'O');
};

const handleCellClick = (r, c) => {
    if (board[r][c] || isComputerThinking || (gameMode === 'pvc' && currentPlayer === 2)) return;
    placeLetter(r, c, selectedLetter);
};

const placeLetter = (r, c, letter) => {
    board[r][c] = { letter: letter, player: currentPlayer };
    const sosCount = checkForSOS(r, c);
    let switchPlayer = true;
    if (sosCount > 0) {
        scores[currentPlayer] += sosCount;
        switchPlayer = false;
    } 
    if (switchPlayer) {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
    }
    renderBoard();
    updateUI();
    if (isBoardFull()) {
        endGame();
        return;
    }
    if (gameMode === 'pvc' && currentPlayer === 2 && !isBoardFull()) {
        isComputerThinking = true;
        updateUI();
        setTimeout(computerMove, 1000);
    }
};

const checkForSOS = (r, c) => {
    const letter = board[r][c].letter;
    let newlyFormedSOS = 0;
    if (letter === 'O') {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (const [dr, dc] of directions) {
            const s1_r = r - dr, s1_c = c - dc;
            const s2_r = r + dr, s2_c = c + dc;
            if (isValid(s1_r, s1_c) && isValid(s2_r, s2_c) && board[s1_r][s1_c]?.letter === 'S' && board[s2_r][s2_c]?.letter === 'S') {
                newlyFormedSOS++;
            }
        }
    } else if (letter === 'S') {
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
        for (const [dr, dc] of directions) {
            const o_r = r + dr, o_c = c + dc;
            const s_r = r + 2 * dr, s_c = c + 2 * dc;
            if (isValid(o_r, o_c) && isValid(s_r, s_c) && board[o_r][o_c]?.letter === 'O' && board[s_r][s_c]?.letter === 'S') {
                newlyFormedSOS++;
            }
        }
    }
    return newlyFormedSOS;
};

const isValid = (r, c) => r >= 0 && r < boardSize && c >= 0 && c < boardSize;
const isBoardFull = () => board.every(row => row.every(cell => cell !== null));

const endGame = () => {
    isComputerThinking = false;
    let winnerText;
    const player2FinalName = gameMode === 'pvc' ? 'Computer' : 'Player 2';
    if (scores[1] > scores[2]) {
        winnerText = "Player 1 Wins! 🏆";
    } else if (scores[2] > scores[1]) {
        winnerText = `${player2FinalName} Wins! 🏆`;
    } else {
        winnerText = "It's a Draw!";
    }
    modalWinner.textContent = winnerText;
    modalScore.textContent = `Player 1: ${scores[1]} - ${player2FinalName}: ${scores[2]}`;
    immortalizeBtn.disabled = false;
    immortalizeBtn.textContent = 'Immortalize on Irys';
    irysReceiptElement.classList.add('hidden');
    modal.classList.remove('invisible', 'opacity-0');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
};

const closeModal = () => {
    modal.classList.add('invisible', 'opacity-0');
    modalContent.classList.add('scale-95');
    modalContent.classList.remove('scale-100');
};

const computerMove = () => {
    if (isBoardFull()) {
        isComputerThinking = false;
        return;
    }
    let move = findBestMove(2); 
    if (!move) {
        move = findBestMove(1);
    }
    if (!move) {
        const emptyCells = [];
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                if (!board[r][c]) emptyCells.push({r, c});
            }
        }
        if (emptyCells.length > 0) {
            const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            move = { r: randomCell.r, c: randomCell.c, letter: Math.random() < 0.6 ? 'S' : 'O' };
        }
    }
    if(move) {
        isComputerThinking = false;
        placeLetter(move.r, move.c, move.letter);
    } else {
         isComputerThinking = false;
         updateUI();
    }
};

const findBestMove = (player) => {
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (!board[r][c]) {
                board[r][c] = { letter: 'S', player: player };
                if (checkForSOS(r, c) > 0) {
                    board[r][c] = null;
                    return { r, c, letter: 'S' };
                }
                board[r][c] = null;
                board[r][c] = { letter: 'O', player: player };
                if (checkForSOS(r, c) > 0) {
                    board[r][c] = null;
                    return { r, c, letter: 'O' };
                }
                board[r][c] = null;
            }
        }
    }
    return null;
};

const immortalizeGame = async () => {
    immortalizeBtn.disabled = true;
    immortalizeBtn.textContent = 'Connecting to wallet...';
    irysReceiptElement.classList.remove('hidden');
    irysReceiptElement.innerHTML = `<p class="text-yellow-400">Please approve the connection in your wallet.</p>`;

    try {
        const irys = await getIrys();
        
        immortalizeBtn.textContent = 'Preparing data...';
        const gameData = { game: "SOS: Irys Immortalized", timestamp: new Date().toISOString(), boardSize, scores, winner: modalWinner.textContent, finalBoard: board.map(row => row.map(cell => cell ? cell.letter : null)) };
        const dataToUpload = JSON.stringify(gameData, null, 2);
        const tags = [{ name: "Content-Type", value: "application/json" }, { name: "App-Name", value: "SOS-Immortalized" }, { name: "Game-Mode", value: gameMode }];

        immortalizeBtn.textContent = 'Uploading to Irys...';
        const receipt = await irys.upload(dataToUpload, { tags });
        
        irysReceiptElement.innerHTML = `<p class="font-bold text-emerald-400">✅ Immortalized Successfully!</p><p class="text-slate-300">Transaction ID:</p><a href="https://devnet.irys.xyz/${receipt.id}" target="_blank" class="text-teal-300 break-all hover:underline">${receipt.id}</a>`;
        immortalizeBtn.textContent = 'Immortalized!';

    } catch (e) {
        console.error("Error during immortalization: ", e);
        irysReceiptElement.innerHTML = `<p class="font-bold text-red-400">❌ Error: ${e.message}</p>`;
        immortalizeBtn.disabled = false;
        immortalizeBtn.textContent = 'Try Again';
    }
};

// --- Event Listeners ---
btnS.addEventListener('click', () => { selectedLetter = 'S'; updateUI(); });
btnO.addEventListener('click', () => { selectedLetter = 'O'; updateUI(); });
startGameBtn.addEventListener('click', initializeGame);
playAgainBtn.addEventListener('click', initializeGame);
immortalizeBtn.addEventListener('click', immortalizeGame);
gameModeSelect.addEventListener('change', () => {
     player2NameElement.textContent = gameModeSelect.value === 'pvc' ? 'Computer (Pink)' : 'Player 2 (Pink)';
});

// --- Initial Load ---
window.onload = initializeGame;

