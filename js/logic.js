'use strict';
//setBy = copyFrom, setIndexes
/*** settings ***/
let settings, savedSettings = getMemory('settings');
if (!savedSettings) {
	settings = {
		rowLength: 16,
		animation: true,
		animationSpeed: 1
	}
}
else settings = savedSettings;

let preferableRowLength, ROW_LENGTH, CELLS_NUM, BEFORE_ROW_HALF, AFTER_ROW_HALF, NUM_MIDDLE_CELLS, indexes, directions;

updateMathBaseVariables();

function updateMathBaseVariables() {
	preferableRowLength = settings.rowLength;
	ROW_LENGTH = preferableRowLength;
	CELLS_NUM = ROW_LENGTH ** 2;
	BEFORE_ROW_HALF = ROW_LENGTH / 2;
	AFTER_ROW_HALF = BEFORE_ROW_HALF - 1;
	NUM_MIDDLE_CELLS = 4;
	indexes = Array.from({ length: CELLS_NUM }, (_, i) => i);

	directions = {
		right: 1,
		left: -1,
		above: -ROW_LENGTH,
		below: ROW_LENGTH,
	};

	directions.rightAbove = directions.right + directions.above;
	directions.rightBelow = directions.right + directions.below;
	directions.leftAbove = directions.left + directions.above;
	directions.leftBelow = directions.left + directions.below;
}

/*** classes ***/
class Board extends Array {
	constructor(source) {
		super();
		this.setBy(source || Board.initialState);
		this.clearHistory();
	}

	setBy(source) {
		const len = source.length;
		for (let i = 0; i < len; i++) {
			this[i] = source[i];
		}
	}

	initialize() {
		this.setBy(Board.initialState);
		this.clearHistory();
	}

	/** calculating of cell change effects **/

	/* getts an player cell sequence that will be captur
	in a given direction only, if his given opponent will set a given cell.
	if there is no any captured sequence, returns false*/
	checkSequence(from, playerId, dirName) {
		const dirOffset = directions[dirName], capturedCells = [];
		let currentIndex = from,
			isPerpendDir = dirName === 'above' || dirName === 'below',
			isRowEdga, cellStatus;
		while (currentIndex += dirOffset, currentIndex >= 0 && currentIndex <= CELLS_NUM) {
			cellStatus = this[currentIndex];
			isRowEdga = currentIndex % ROW_LENGTH === 0 || currentIndex % ROW_LENGTH === ROW_LENGTH - 1;
			if (cellStatus === 0) return false;
			if (cellStatus === playerId) {
				if (capturedCells.length) {
					return { dirName, from, to: currentIndex, between: capturedCells };
				}
				return false;
			}
			if (isRowEdga && !isPerpendDir) return false;
			capturedCells.push(currentIndex);
		}
		return false;
	}

	/* getts all cells sequence that the change will captur
	witout the captured cells that the captured cells will cause by themaels*/
	findSequences(originIndex, playerId = currentPlayerId) {
		const sequences = [];
		let sequenceForDir;
		for (let dirName in directions) {
			sequenceForDir = this.checkSequence(originIndex, playerId, dirName);
			if (sequenceForDir) sequences.push(sequenceForDir);
		}
		return sequences;
	}

	/* applyes (actually) and returns all next ages of cell changing effects*/
	applySecondaryStepEffects(currentAge, previousAge = [], playerId = currentPlayerId) {
		const flatCurrentAge = Board.mapFlat(currentAge),
			newAge = [];
		let children;
		for (let cellIndex of flatCurrentAge) {
			this[cellIndex] = playerId;
		}
		for (let cellIndex of flatCurrentAge) {
			children = this.findSequences(cellIndex, playerId);
			Board.mapFlat(children).forEach(child => this[child] = playerId);
			if (children.length) {
				newAge.push(...children);
			}
		}
		if (newAge.length) {
			return this.applySecondaryStepEffects(newAge, previousAge.concat(currentAge));
		}
		return previousAge.concat(currentAge);
	}

	/* applyes (actually) and returns all effects of cell changing*/
	applyAllStepEffects(cellIndex, playerId) {
		const firstSequences = this.findSequences(cellIndex, playerId);
		assert(firstSequences.length, 'invalid step');
		return this.applySecondaryStepEffects(firstSequences, [], playerId);
	}

	/* set a cell if possibule
	and apply the effects */
	setPrimaryCell(cellIndex, playerId) {
		if (!this.getAllowedCellsFor(playerId).includes(cellIndex)) return false;
		this[cellIndex] = playerId;
		const effects = this.applyAllStepEffects(cellIndex, playerId);
		return effects; // the effects list will be used for animation
	}

	/** potential of cells **/
	getAllowedCellsFor(playerId) {
		const allowedCells = indexes.filter(index => {
			return this[index] === 0 && this.canCaptur(index, playerId);
		});
		return allowedCells;
	}

	canCaptur(cellIndex, playerId = currentPlayerId) {
		for (let dirName in directions) {
			if (this.checkSequence(cellIndex, playerId, dirName)) {
				return true;
			}
		}
		return false;
	}

	/** board review **/
	group() {
		return Object.groupBy(indexes, (index) => this[index]);
	}

	count() {
		const grouped = this.group();
		return [
			(grouped[0] || []).length,
			(grouped[1] || []).length,
			(grouped[2] || []).length
		];
	}

	busyCellsCount() {
		const count = this.count();
		return count[1] + count[2];
	}

	/** move between board versions **/
	moveToPreviousVersion() {
		if (this.version === 0) return false;
		this.setBy(this.history[--this.version]);
		updatePlayersVariables();
		return true;
	}

	moveToNextVersion() {
		if (this.version === this.history.length - 1) return false;
		this.setBy(this.history[++this.version]);
		updatePlayersVariables();
		return true;
	}

	clearHistory() {
		this.history = [[...this]];
		this.version = 0;
	}
}

Board.initialState = Array(CELLS_NUM);
const initialState = Board.initialState;
initialState.fill(0);
// set the 4 middle cells. by default (i.e. when ROW_LENGTH is 16): 7:7, 7:8, 8:7, 8:8
initialState[AFTER_ROW_HALF * ROW_LENGTH + AFTER_ROW_HALF] = 1;
initialState[BEFORE_ROW_HALF * ROW_LENGTH + BEFORE_ROW_HALF] = 1;
initialState[AFTER_ROW_HALF * ROW_LENGTH + BEFORE_ROW_HALF] = 2;
initialState[BEFORE_ROW_HALF * ROW_LENGTH + AFTER_ROW_HALF] = 2;

Board.mapFlat = function (sequencesArray) {
	return sequencesArray.map(seq => seq.between).flat();
}

class Player {
	constructor(id, name, isComputer) {
		assert(id, 'ID נדרש.');
		assert(name, 'שם שחקן נדרש.');
		[this.id, this.name, this.isComputer] = [id, name, !!isComputer];
	}

	get score() {
		return board.count()[this.id];
	}

	get hasStepOption() {
		return board.getAllowedCellsFor(this.id).length > 0;
	}
}

class Game {
	constructor(player1, player2, board) {
		this.player1 = player1;
		this.player2 = player2;
		this.isPlayer2Computer = this.player2.isComputer;
		this.board = board || new Board();
		this.initialize();
	}

	initialize() {
		this.currentPlayer = this.player1;
	}

	/** getters **/
	get isActive() {
		return !this.winner;
	}

	get stepsCount() {
		return board.busyCellsCount() - NUM_MIDDLE_CELLS;
	}

	get opponentPlayer() {
		return this.currentPlayer === this.player1 ? this.player2 : this.player1;
	}

	get winner() {
		if (this.player1.hasStepOption || this.player2.hasStepOption) return null;
		const count = this.board.count();
		if (count[1] > count[2]) return this.player1;
		if (count[1] < count[2]) return this.player2;
		return 'draw';
	}

	/** user action **/
	playStep(index) {
		const changes = board.setPrimaryCell(index, currentPlayerId);
		return changes;
	}

	/* only called by a new step */
	afterPlayStep() {
		board.history.splice(board.version + 1);
		const boardCopy = [...board];
		board.version = board.history.push(boardCopy) - 1;
		this.changeTurn(); // now currentPlayer = opponentPlayer, opponentPlayer = currentPlayer!
		this.afterBoardChange();
	}

	/* called by this.undo() or redo() too */
	afterBoardChange() {
		if (this.winner) return;
		if (!currentPlayer.hasStepOption && opponentPlayer.hasStepOption) {
			this.changeTurn(true);
		}
	}

	changeTurn(isSkiped = false) {
		this.currentPlayer = this.opponentPlayer;
		updatePlayersVariables();
		this.isLastTurnSpiked = isSkiped;
	}

	undo() {
		let succeed = board.moveToPreviousVersion();
		if (!succeed) return false;
		this.changeTurn();
		this.afterBoardChange();
		return true;
	}

	redo() {
		let succeed = board.moveToNextVersion();
		if (!succeed) return false;
		this.changeTurn();
		this.afterBoardChange();
		return true;
	}
}

Game.createFrom = function (gameData) {
	const player1clone = Object.setPrototypeOf(gameData.player1, Player.prototype),
		player2clone = Object.setPrototypeOf(gameData.player2, Player.prototype),
		boardClone = new Board(gameData.board);

	boardClone.history = [[...gameData.board]];
	const completeClone = new Game(player1clone, player2clone, boardClone);
	completeClone.currentPlayer = completeClone['player' + gameData.currentPlayer.id];
	return completeClone;
}

/*** helper functions ***/
function assert(condition, message) {
	if (!condition) throw new Error(message);
}

/** when  activeGame changes,
 * update the variables below so that they
 * will reference to the currnet activeGame propertyes**/
function updatePlayersVariables() {
	currentPlayer = activeGame.currentPlayer;
	opponentPlayer = activeGame.opponentPlayer;
	currentPlayerId = currentPlayer.id;
	opponentPlayerId = opponentPlayer.id;
}

/*** memory ***/
function setMemory(...types) {
	for (let type of types) {
		if (type === 'game') setGameMemory();
		else if (type === 'steting') {
			localStorage.setItem('settings', JSON.stringify(settings));
		}
	}
}

function getMemory(type) {
	const json = localStorage.getItem(type);
	if (!json) return;
	let savedData = JSON.parse(json);
	if (type === 'game') return Game.createFrom(savedData);
	return savedData;
}

function setGameMemory() {
	if (!activeGame.stepsCount) return;
	const frugal = activeGame;
	frugal.board.history = [board.history[0]];
	frugal.board.version = 0;
	localStorage.setItem('game', JSON.stringify(frugal));
}

/*** short names for some useful activeGame propetries ***/
let activeGame, board, currentPlayer, opponentPlayer, currentPlayerId, opponentPlayerId;

/*** debugging ***/
function randomSteps(num) {
	let animationSetting = settings.animation;
	settings.animation = false;
	let allowedCells, random, randomCell;
	for (let i = 0; i < num; i++) {
		allowedCells = board.getAllowedCellsFor(currentPlayerId);
		if (!allowedCells.length) return;
		random = Math.round(Math.random() * (allowedCells.length - 1)),
			randomCell = allowedCells[random];
		circlesElements[randomCell].click();
	}
	settings.animation = animationSetting;
}

function clearAll() {
	board.initialize();
	activeGame.initialize();
	updatePlayersVariables();
	updateDisplay();
	localStorage.removeItem('game');
}