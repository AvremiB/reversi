'use strict';
/*** create the HTML board element accurding to settings ***/
const tbodyElement = document.querySelector('#game-board > tbody');
function addRow() {
	const row = document.createElement('tr');
	tbodyElement.append(row);
	return row;
}

function addCell(row, num) {
	const cellElement = document.createElement('td'),
		circleElement = document.createElement('div');
	cellElement.classList.add('board-cell');
	circleElement.classList.add('reversi-circle');
	circleElement.dataset.index = num;
	cellElement.append(circleElement);
	row.append(cellElement);
}

function fillRow(row, from, to) {
	for (let i = from; i < to; i++) {
		addCell(row, i);
	}
}

for (let i = 0; i < ROW_LENGTH; i++) {
	let currentRow = addRow();
	fillRow(currentRow, i * ROW_LENGTH, i * ROW_LENGTH + ROW_LENGTH);
}

document.body.hidden = false;

/*** DOM variables ***/
const boardElement = document.getElementById('game-board'),
	boardCellElements = boardElement.getElementsByTagName('td'),
	circlesElements = boardElement.getElementsByClassName('reversi-circle'),
	turnElement = document.getElementById('turn'),
	player1scoreElement = document.getElementById('player1-score'),
	player2scoreElement = document.getElementById('player2-score'),
	stepsToEndElement = document.getElementById('steps-to-end'),
	buttonsElement = document.getElementById('buttons'),
	buttons = [...buttonsElement.children],
	undoButton = document.getElementById('undo'),
	redoButton = document.getElementById('redo'),
	clearButton = document.getElementById('clear'),
	randomalStepsButton = document.getElementById('randomal-steps'),
	stopAnimationButton = document.getElementById('stop-aninmation');

/*** event listeners ***/
window.addEventListener('beforeunload', () => setMemory('game', 'settings'));
document.addEventListener('DOMContentLoaded', playGame);
document.addEventListener('keydown', keyDownHandler);
boardElement.addEventListener('click', tableClickHandler);
buttonsElement.addEventListener('click', buttonsClickHandler);

/*** event handlers ***/

/** start game **/
function playGame() {
	const savedGame = getMemory('game');
	activeGame = savedGame || new Game(new Player(1, 'השחור'), new Player(2, 'הלבן'));
	board = activeGame.board;
	updatePlayersVariables();
	if (savedGame) {
		activeGame.afterBoardChange();
	}
	updateDisplay();
}

async function tableClickHandler(event) {
	if (!activeGame.isActive) return;
	if (animating) return;
	const target = event.target;
	if (!target.classList.contains('reversi-circle')) return;
	//if (!target.classList.contains('allowed')) return;
	const clickedIndex = +target.dataset.index;
	const changes = activeGame.playStep(clickedIndex);
	if (!changes) return;
	activeGame.afterPlayStep();
	if (settings.animation) {
		circlesElements[clickedIndex].dataset.player = opponentPlayerId;
		startAnimateChanges(changes, currentPlayerId /* this is the captured player id right now,
		because updatePlayersVariables() has been called */);
	}
	else updateDisplay();
}

function keyDownHandler(event) {
	const code = event.code;
	switch (true) {
		case code === 'Delete' && event.shiftKey: clearAll();
			break;
		case currentPlayer.isComputer: break;
		case (!event.ctrlKey || event.shiftKey || event.altKey): break;
		case code === 'KeyZ': buttonsHandlers.undo();
			break;
		case code === 'KeyY': buttonsHandlers.redo();
	}
}

const buttonsHandlers = {
	undo: () => { if (activeGame.undo()) updateDisplay() },
	redo: () => { if (activeGame.redo()) updateDisplay() },
	clear: clearAll,
	'randomal-steps': () => randomSteps(30),
	'stop-aninmation' : () => animating = false
}

function buttonsClickHandler(event) {
	const target = event.target;
	if (target === this) return;
	if (target.classList.contains('disable')) return;
	buttonsHandlers[target.id]();
}

/*** display ***/
/** update the display of the game board, game state and **/
function updateDisplay(sourceGame = activeGame) {
	updateStateArea(sourceGame);
	updateBoardDisplay(sourceGame.board);
}

function updateBoardDisplay(sourceBoard) {
	const len = sourceBoard.length;
	for (let i = 0; i < len; i++) {
		circlesElements[i].dataset.player = sourceBoard[i];
	}
	updateBoardCellsStyle(sourceBoard);
}

function updateBoardCellsStyle(sourceBoard) {
	const allowedCells = sourceBoard.getAllowedCellsFor(currentPlayerId);
	[...boardCellElements].forEach((td, index) => {
		td.classList.toggle('allowed', allowedCells.includes(index));
	});
}

function updateStateArea(sourceGame) {
	updateScoreDislay(sourceGame);

	const winner = sourceGame.winner;
	if (winner) {
		updateWinDisplay(winner);
	}
	else {
		updateTurnDisplay(sourceGame);
	}

	updateStateAreaStyle(sourceGame);
}

function updateScoreDislay(sourceGame) {
	player1scoreElement.innerText = sourceGame.player1.score;
	player2scoreElement.innerText = sourceGame.player2.score;
}

function updateWinDisplay(winner) {
	assert(winner, 'winner must be a Player object or the String `draw`');
	stepsToEndElement.innerText = '';
	if (winner.constructor === Player) turnElement.innerHTML = `${winner.name} ניצח!`.bold();
	else turnElement.innerHTML = `תיקו!`.bold();
}

function updateTurnDisplay(sourceGame) {
	let first = sourceGame.stepsCount === 0 ? 'השחור תמיד ראשון: ' : '',
		skiped = sourceGame.isLastTurnSpiked ? 'נשאר ' : '';
	turnElement.innerText = `${first} התור ${skiped} של ${sourceGame.currentPlayer.name}.`;
	const stepsToEnd = board.length - sourceGame.stepsCount - NUM_MIDDLE_CELLS;
	if (stepsToEnd <= 15) {
		stepsToEndElement.innerText = `נותרו עד: ${stepsToEnd} צעדים`;
	} else stepsToEndElement.innerText = '';
}

function updateStateAreaStyle(sourceGame) {
	const winnerId = (sourceGame.winner?.id || 0);
	//score elements style
	player1scoreElement.classList.toggle('winner', winnerId === 1);
	player2scoreElement.classList.toggle('winner', winnerId === 2);
	// buttons style
	undoButton.classList.toggle('disabled', !sourceGame.board.version);
	redoButton.classList.toggle('disabled', sourceGame.board.version === sourceGame.board.history.length - 1);
	randomalStepsButton.classList.toggle('disabled', !sourceGame.isActive);
	clearButton.classList.toggle('disabled', !sourceGame.stepsCount && !board.version);
	clearButton.classList.toggle('bold', winnerId);
}

/*** animations ***/
let animating = false;

function startCapturersAnimation(capturer1, capturer2) {
	capturer1.classList.add('captures');
	capturer2.classList.add('captures');
}

function startAnimateChanges(sequencesArr, capturedPlayerId) {
	animating = true;
	[...circlesElements].forEach((td) => {
		td.classList.remove('allowed');
	});
	boardElement.style.cursor = 'not-allowed';
	buttons.forEach(btn => btn.hidden = !btn.hidden);
	animateChanges(sequencesArr, capturedPlayerId);
}

function endCapturingSequenceAnimation(capturersElements, capturedElements, capturedPlayerId) {
	capturersElements[0].classList.remove('captures');
	capturersElements[1].classList.remove('captures');
	capturedElements.forEach(circle => {
		circle.style.backgroundColor = '';
		circle.dataset.player = capturedPlayerId === 1 ? 2 : 1;
	});
}

function endAnimateChanges() {
	boardElement.style.cursor = '';
	buttons.forEach(btn => {
		btn.hidden = !btn.hidden;
	})
	updateDisplay();
}

async function animateChanges(sequencesArr, capturedPlayerId) {
	const currentSequence = sequencesArr.shift();
	if (!currentSequence) {
		animating = false;
		endAnimateChanges();
		return;
	};
	const capturer1element = circlesElements[currentSequence.from],
		capturer2element = circlesElements[currentSequence.to],
		cepturedCellElements = currentSequence.between.map(cellIndex => circlesElements[cellIndex]);
		startCapturersAnimation(capturer1element, capturer2element);

	let currentWhiteness, finallyWhiteness, isWhitenessInRange;
	if (capturedPlayerId === 1) {
		currentWhiteness = 0;
		finallyWhiteness = 255;
		isWhitenessInRange = (currentWhiteness, finallyWhiteness) => currentWhiteness <= finallyWhiteness;
	}
	else {
		currentWhiteness = 255;
		finallyWhiteness = 0;
		isWhitenessInRange = (currentWhiteness, finallyWhiteness) => currentWhiteness >= finallyWhiteness;
	}

	let previousTime = performance.now();

	gradationalDye(cepturedCellElements, finallyWhiteness, currentWhiteness);

	function gradationalDye(circles, finallyWhiteness, currentWhiteness, time = 0) {
		if (!animating) {
			endCapturingSequenceAnimation([capturer1element, capturer2element], cepturedCellElements, capturedPlayerId);
			endAnimateChanges();
			return;
		}
		if (isWhitenessInRange(currentWhiteness, finallyWhiteness)) {
			let timePassed = time - previousTime,
				whitenessDiff = Math.ceil(timePassed / settings.animatioSpeed),
				newWhiteness = finallyWhiteness === 0 ? currentWhiteness -= whitenessDiff : currentWhiteness += whitenessDiff,
				newRgb = rgb(newWhiteness);
			circles.forEach(circle => circle.style.backgroundColor = newRgb);
			previousTime = time;

			requestAnimationFrame((time) => gradationalDye(circles, finallyWhiteness, newWhiteness, time));
		} else {
			endCapturingSequenceAnimation([capturer1element, capturer2element], cepturedCellElements, capturedPlayerId);
			animateChanges(sequencesArr, capturedPlayerId);
		}
	}
}

function rgb(num) {
	return `rgb(${num},${num},${num})`;
}