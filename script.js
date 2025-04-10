// Thêm vào phần đầu script.js các biến và hàm cần thiết cho chế độ multiplayer

// Thêm các biến cho chế độ multiplayer
let roomId = null;
let isHost = false;
let opponentName = '';
let playerName = '';
let gameStarted = false;
let gameFinished = false;
let startTime = 0;
let timerInterval;
let playerSolved = false;
let opponentSolved = false;
let opponentTime = 0;
let pollingInterval; // Biến để lưu trữ interval cho việc polling

// URL API backend
const API_URL = "https://sudoku-backend-1.onrender.com";

// Khởi tạo thêm các phần tử DOM cho chế độ multiplayer
const multiplayerSection = document.createElement('div');
multiplayerSection.id = 'multiplayerSection';
multiplayerSection.className = 'control-section';
multiplayerSection.innerHTML = `
  <h2>Chế độ 2 người chơi</h2>
  <div id="playerSetup">
    <input type="text" id="playerNameInput" placeholder="Nhập tên của bạn" required>
    <button id="createRoomBtn">Tạo phòng đấu</button>
    <div id="roomJoin">
      <input type="text" id="roomIdInput" placeholder="Nhập mã phòng">
      <button id="joinRoomBtn">Tham gia phòng</button>
    </div>
  </div>
  
  <div id="gameRoom" style="display: none;">
    <div id="roomInfo">
      <p>Mã phòng: <span id="roomIdDisplay"></span></p>
      <button id="copyRoomIdBtn">Sao chép mã phòng</button>
    </div>
    <div id="playersInfo">
      <div id="playerInfo" class="player-info">
        <h3>Bạn: <span id="playerNameDisplay"></span></h3>
        <p>Thời gian: <span id="playerTimer">00:00</span></p>
        <p>Trạng thái: <span id="playerStatus">Chưa sẵn sàng</span></p>
      </div>
      <div id="opponentInfo" class="player-info">
        <h3>Đối thủ: <span id="opponentNameDisplay">Đang chờ...</span></h3>
        <p>Thời gian: <span id="opponentTimer">00:00</span></p>
        <p>Trạng thái: <span id="opponentStatus">Chưa sẵn sàng</span></p>
      </div>
    </div>
    <div id="gameControls">
      <button id="readyBtn">Sẵn sàng</button>
      <button id="startGameBtn" disabled>Bắt đầu trận đấu</button>
      <button id="finishGameBtn" disabled>Hoàn thành</button>
      <button id="leaveRoomBtn">Rời phòng</button>
    </div>
    <div id="gameResult" style="display: none;">
      <h3>Kết quả trận đấu</h3>
      <p id="winnerDisplay"></p>
      <p id="resultInfo"></p>
    </div>
  </div>
`;

// Thêm section multiplayer vào DOM
document.body.insertBefore(multiplayerSection, document.getElementById('sudokuGrid').nextSibling);

// Khởi tạo multiplayer khi trang được tải
function initializeMultiplayer() {
  // Lấy các phần tử DOM
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const readyBtn = document.getElementById('readyBtn');
  const startGameBtn = document.getElementById('startGameBtn');
  const finishGameBtn = document.getElementById('finishGameBtn');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const copyRoomIdBtn = document.getElementById('copyRoomIdBtn');
  
  // Thêm event listeners cho các nút
  createRoomBtn.addEventListener('click', createRoom);
  joinRoomBtn.addEventListener('click', joinRoom);
  readyBtn.addEventListener('click', toggleReady);
  startGameBtn.addEventListener('click', startGame);
  finishGameBtn.addEventListener('click', finishGame);
  leaveRoomBtn.addEventListener('click', leaveRoom);
  copyRoomIdBtn.addEventListener('click', copyRoomId);
}

// Hàm polling để kiểm tra trạng thái phòng
function startPolling() {
  // Dừng interval cũ nếu có
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  // Tạo interval mới và kiểm tra trạng thái mỗi 2 giây
  pollingInterval = setInterval(() => {
    if (!roomId) return; // Nếu không có phòng thì không cần polling
    
    // Gọi API để lấy trạng thái phòng
    fetch(`${API_URL}/room-status/${roomId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Không thể kết nối đến server');
        }
        return response.json();
      })
      .then(data => {
        processRoomStatus(data);
      })
      .catch(error => {
        console.error('Error polling room status:', error);
      });
  }, 2000);
}

// Xử lý dữ liệu trạng thái phòng nhận từ server
function processRoomStatus(data) {
  // Kiểm tra nếu có người chơi khác tham gia
  if (data.players && data.players.length > 1) {
    const opponent = data.players.find(player => player.name !== playerName);
    if (opponent && opponentName !== opponent.name) {
      opponentName = opponent.name;
      document.getElementById('opponentNameDisplay').textContent = opponentName;
      document.getElementById('opponentStatus').textContent = opponent.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng';
    }
    
    // Cập nhật trạng thái sẵn sàng của đối thủ
    if (opponent) {
      document.getElementById('opponentStatus').textContent = opponent.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng';
      
      // Nếu là host, kiểm tra nếu cả hai người chơi đều sẵn sàng
      if (isHost) {
        const playerReady = document.getElementById('playerStatus').textContent === 'Sẵn sàng';
        const opponentReady = opponent.ready;
        document.getElementById('startGameBtn').disabled = !(playerReady && opponentReady);
      }
    }
  }
  
  // Kiểm tra xem trò chơi đã bắt đầu chưa
  if (data.gameStarted && !gameStarted) {
    startGameForAll(data.grid, data.size);
  }
  
  // Kiểm tra xem đối thủ đã hoàn thành chưa
  if (data.players) {
    const opponent = data.players.find(player => player.name !== playerName);
    if (opponent && opponent.solved && !opponentSolved) {
      opponentSolved = true;
      opponentTime = opponent.time;
      document.getElementById('opponentTimer').textContent = formatTime(opponentTime);
      document.getElementById('opponentStatus').textContent = 'Đã hoàn thành';
      
      // Kiểm tra nếu cả hai người chơi đã hoàn thành
      checkGameCompletion();
    }
  }
  
  // Kiểm tra xem trò chơi đã kết thúc chưa
  if (data.gameFinished && !gameFinished) {
    endGame(data.result);
  }
}

// Tạo phòng mới
function createRoom() {
  playerName = document.getElementById('playerNameInput').value.trim();
  
  if (!playerName) {
    alert('Vui lòng nhập tên của bạn');
    return;
  }
  
  fetch(`${API_URL}/create-room`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ playerName })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Không thể tạo phòng');
    }
    return response.json();
  })
  .then(data => {
    roomId = data.roomCode;
    isHost = true;
    enterRoom();
    startPolling(); // Bắt đầu polling để kiểm tra trạng thái phòng
  })
  .catch(error => {
    console.error('Error creating room:', error);
    alert('Không thể tạo phòng: ' + error.message);
  });
}

// Tham gia phòng có sẵn
function joinRoom() {
  playerName = document.getElementById('playerNameInput').value.trim();
  const roomToJoin = document.getElementById('roomIdInput').value.trim();
  
  if (!playerName) {
    alert('Vui lòng nhập tên của bạn');
    return;
  }
  
  if (!roomToJoin) {
    alert('Vui lòng nhập mã phòng');
    return;
  }
  
  fetch(`${API_URL}/join-room`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ playerName, roomId: roomToJoin })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Không thể tham gia phòng');
    }
    return response.json();
  })
  .then(data => {
    roomId = roomToJoin;
    isHost = false;
    opponentName = data.hostName;
    enterRoom();
    startPolling(); // Bắt đầu polling để kiểm tra trạng thái phòng
    
    // Nếu là người tham gia, nhận lưới Sudoku từ host (qua polling)
  })
  .catch(error => {
    console.error('Error joining room:', error);
    alert('Không thể tham gia phòng: ' + error.message);
  });
}

// Vào phòng đấu
function enterRoom() {
  document.getElementById('playerSetup').style.display = 'none';
  document.getElementById('gameRoom').style.display = 'block';
  document.getElementById('roomIdDisplay').textContent = roomId;
  document.getElementById('playerNameDisplay').textContent = playerName;
  
  // Nếu là host, hiển thị nút bắt đầu
  if (isHost) {
    document.getElementById('startGameBtn').style.display = 'inline-block';
  } else {
    document.getElementById('startGameBtn').style.display = 'none';
  }
}

// Sao chép mã phòng
function copyRoomId() {
  navigator.clipboard.writeText(roomId)
    .then(() => alert('Đã sao chép mã phòng: ' + roomId))
    .catch(err => console.error('Không thể sao chép mã phòng: ', err));
}

// Chuyển đổi trạng thái sẵn sàng
function toggleReady() {
  const readyBtn = document.getElementById('readyBtn');
  const playerStatusElement = document.getElementById('playerStatus');
  const isReady = playerStatusElement.textContent === 'Sẵn sàng';
  
  // Đảo ngược trạng thái sẵn sàng
  if (isReady) {
    playerStatusElement.textContent = 'Chưa sẵn sàng';
    readyBtn.textContent = 'Sẵn sàng';
  } else {
    playerStatusElement.textContent = 'Sẵn sàng';
    readyBtn.textContent = 'Hủy sẵn sàng';
  }
  
  // Gửi trạng thái mới đến server
  fetch(`${API_URL}/toggle-ready`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      roomId,
      playerName,
      isHost,
      isReady: !isReady
    })
  })
  .catch(error => {
    console.error('Error toggling ready status:', error);
  });
}

// Bắt đầu trận đấu (chỉ host mới gọi hàm này)
function startGame() {
  if (!isHost) return;
  
  const size = parseInt(gridSizeSelect.value);
  const difficulty = difficultySelect.value;
  
  // Tạo lưới Sudoku mới
  const grid = generateCompleteSudoku(size);
  shuffleSudoku(grid, size);
  
  const difficultyPercentage = { easy: 0.4, medium: 0.5, hard: 0.6 };
  removeNumbers(grid, size, difficultyPercentage[difficulty]);
  
  // Gửi thông tin lưới Sudoku và bắt đầu trận đấu
  fetch(`${API_URL}/start-game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      roomId,
      grid,
      size
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Không thể bắt đầu trận đấu');
    }
    return response.json();
  })
  .then(data => {
    // Trò chơi bắt đầu thành công, hiển thị lưới
    startGameForAll(grid, size);
  })
  .catch(error => {
    console.error('Error starting game:', error);
    alert('Không thể bắt đầu trận đấu: ' + error.message);
  });
}

// Bắt đầu trận đấu cho tất cả người chơi (được gọi khi nhận sự kiện game-started)
function startGameForAll(grid, size) {
  // Hiển thị lưới Sudoku
  displaySudokuGrid(grid, size);
  
  // Kích hoạt chế độ chơi
  gameStarted = true;
  playerSolved = false;
  opponentSolved = false;
  
  // Cập nhật giao diện
  document.getElementById('readyBtn').disabled = true;
  document.getElementById('startGameBtn').disabled = true;
  document.getElementById('finishGameBtn').disabled = false;
  document.getElementById('playerStatus').textContent = 'Đang chơi';
  document.getElementById('opponentStatus').textContent = 'Đang chơi';
  document.getElementById('gameResult').style.display = 'none';
  
  // Bắt đầu đếm thời gian
  startTime = Date.now();
  startTimer();
}

// Bắt đầu đếm thời gian
function startTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timerInterval = setInterval(() => {
    if (gameStarted && !playerSolved) {
      const currentTime = Math.floor((Date.now() - startTime) / 1000);
      document.getElementById('playerTimer').textContent = formatTime(currentTime);
    }
  }, 1000);
}

// Định dạng thời gian từ giây sang phút:giây
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Hoàn thành trận đấu
function finishGame() {
  const size = parseInt(gridSizeSelect.value);
  const grid = getGridData(size);
  
  // Kiểm tra xem lưới Sudoku có được giải đúng không
  if (!checkSudokuSolution(grid, size)) {
    alert('Lưới Sudoku chưa được giải đúng!');
    return;
  }
  
  // Tính thời gian hoàn thành
  const finishTime = Math.floor((Date.now() - startTime) / 1000);
  playerSolved = true;
  
  // Cập nhật giao diện
  document.getElementById('playerStatus').textContent = 'Đã hoàn thành';
  document.getElementById('playerTimer').textContent = formatTime(finishTime);
  document.getElementById('finishGameBtn').disabled = true;
  
  // Gửi thông tin hoàn thành đến server
  fetch(`${API_URL}/player-finish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      roomId,
      playerName,
      isHost,
      time: finishTime
    })
  })
  .catch(error => {
    console.error('Error submitting finish:', error);
  });
  
  // Kiểm tra nếu cả hai người chơi đã hoàn thành
  checkGameCompletion();
}

// Kiểm tra nếu cả hai người chơi đã hoàn thành
function checkGameCompletion() {
  if (playerSolved && opponentSolved) {
    const playerTime = Math.floor((Date.now() - startTime) / 1000);
    
    // Xác định người chiến thắng
    const result = {
      playerName,
      playerTime: playerSolved ? playerTime : null,
      opponentName,
      opponentTime: opponentSolved ? opponentTime : null,
      winner: playerTime < opponentTime ? playerName : opponentName
    };
    
    // Nếu là host, gửi kết quả đến server
    if (isHost) {
      fetch(`${API_URL}/game-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId,
          result
        })
      })
      .catch(error => {
        console.error('Error completing game:', error);
      });
    }
    
    // Kết thúc trò chơi
    endGame(result);
  }
}

// Kết thúc trò chơi và hiển thị kết quả
function endGame(result) {
  gameStarted = false;
  gameFinished = true;
  
  // Dừng đếm thời gian
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Hiển thị kết quả
  document.getElementById('gameResult').style.display = 'block';
  document.getElementById('winnerDisplay').textContent = `Người chiến thắng: ${result.winner}`;
  
  let resultText = `${playerName}: ${formatTime(result.playerTime || 0)}\n${opponentName}: ${formatTime(result.opponentTime || 0)}`;
  document.getElementById('resultInfo').textContent = resultText;
  
  // Kích hoạt lại các nút
  document.getElementById('readyBtn').disabled = false;
  document.getElementById('finishGameBtn').disabled = true;
  
  if (isHost) {
    document.getElementById('startGameBtn').disabled = true;
  }
}

// Rời phòng
function leaveRoom() {
  fetch(`${API_URL}/leave-room`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ roomId, playerName, isHost })
  })
  .catch(error => {
    console.error('Error leaving room:', error);
  });
  
  // Dừng polling
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  // Reset các biến và giao diện
  roomId = null;
  isHost = false;
  opponentName = '';
  gameStarted = false;
  gameFinished = false;
  playerSolved = false;
  opponentSolved = false;
  
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Ẩn phòng chơi, hiển thị phần thiết lập
  document.getElementById('gameRoom').style.display = 'none';
  document.getElementById('playerSetup').style.display = 'block';
}

// Thêm css cho các phần tử multiplayer
const multiplayerStyles = document.createElement('style');
multiplayerStyles.innerHTML = `
  #multiplayerSection {
    margin-top: 20px;
    padding: 15px;
    border: 1px solid #ccc;
    border-radius: 5px;
  }
  
  #playerSetup {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  #roomJoin {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }
  
  #roomInfo {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  #playersInfo {
    display: flex;
    justify-content: space-between;
    margin-bottom: 15px;
  }
  
  .player-info {
    flex: 1;
    padding: 10px;
    border: 1px solid #eee;
    border-radius: 5px;
    margin: 0 5px;
  }
  
  #gameControls {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  #gameResult {
    padding: 15px;
    border: 1px solid #ddd;
    border-radius: 5px;
    margin-top: 15px;
    background-color: #f9f9f9;
  }
  
  input, button {
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #ccc;
  }
  
  button {
    cursor: pointer;
    background-color: #4CAF50;
    color: white;
    border: none;
  }
  
  button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;
document.head.appendChild(multiplayerStyles);

// Khởi tạo chế độ multiplayer khi trang được tải
document.addEventListener('DOMContentLoaded', function() {
  // Khởi tạo phần multiplayer sau khi trang đã tải
  initializeMultiplayer();
});
// Khởi tạo phần tử DOM
const sudokuGrid = document.getElementById('sudokuGrid');
const gridSizeSelect = document.getElementById('gridSize');
const difficultySelect = document.getElementById('difficulty');
const generateBtn = document.getElementById('generateBtn');
const solveBtn = document.getElementById('solveBtn');
const clearBtn = document.getElementById('clearBtn');
const clearAllBtn = document.getElementById('clearAllBtn'); // Thêm nút Clear All
const createGridBtn = document.getElementById('createGridBtn'); // Nút tạo lưới nhập

// Thêm biến cho chức năng đếm thời gian chơi đơn
let singlePlayerTimer = 0;
let singlePlayerTimerInterval;
let singlePlayerTimerRunning = false;
const timerDisplay = document.createElement('div');
timerDisplay.id = 'timerDisplay';
timerDisplay.className = 'timer-display';
timerDisplay.textContent = '00:00';

// Tạo nút điều khiển đồng hồ
const timerButton = document.createElement('button');
timerButton.id = 'timerBtn';
timerButton.textContent = 'Bắt đầu đếm giờ';
timerButton.className = 'control-button';

// Thêm nút đếm giờ vào gần nút Tools
const toolsBtn = document.querySelector('.tools-button') || document.getElementById('toolsBtn');
if (toolsBtn && toolsBtn.parentNode) {
    toolsBtn.parentNode.insertBefore(timerButton, toolsBtn.nextSibling);
    // Thêm hiển thị thời gian phía trên nút
    toolsBtn.parentNode.insertBefore(timerDisplay, timerButton);
}

// Hàm bắt đầu đếm thời gian cho chế độ chơi đơn
function startSinglePlayerTimer() {
    if (singlePlayerTimerRunning) return;
    
    singlePlayerTimer = 0;
    singlePlayerTimerRunning = true;
    timerButton.textContent = 'Dừng đếm giờ';
    
    singlePlayerTimerInterval = setInterval(() => {
        singlePlayerTimer++;
        timerDisplay.textContent = formatTime(singlePlayerTimer);
    }, 1000);
}

// Hàm dừng đếm thời gian cho chế độ chơi đơn
function stopSinglePlayerTimer() {
    if (!singlePlayerTimerRunning) return;
    
    clearInterval(singlePlayerTimerInterval);
    singlePlayerTimerRunning = false;
    timerButton.textContent = 'Bắt đầu đếm giờ';
}

// Hàm reset đồng hồ
function resetSinglePlayerTimer() {
    stopSinglePlayerTimer();
    singlePlayerTimer = 0;
    timerDisplay.textContent = '00:00';
}

// Thêm sự kiện cho nút đếm giờ
timerButton.addEventListener('click', () => {
    if (singlePlayerTimerRunning) {
        stopSinglePlayerTimer();
    } else {
        startSinglePlayerTimer();
    }
});

// Thêm CSS cho timer
const timerStyles = document.createElement('style');
timerStyles.innerHTML = `
    .timer-display {
        font-size: 24px;
        font-weight: bold;
        margin: 10px 0;
        text-align: center;
        color: #333;
    }
    
    #timerBtn {
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 10px 15px;
        margin: 5px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }
    
    #timerBtn:hover {
        background-color: #45a049;
    }
`;
document.head.appendChild(timerStyles);

// Kết nối chức năng đếm giờ với các nút khác
generateBtn.addEventListener('click', () => {
    // Giữ lại code cũ
    const size = parseInt(gridSizeSelect.value);
    const difficulty = difficultySelect.value;
    generateMultipleSudoku(size, difficulty);
    
    // Thêm: Reset đồng hồ khi tạo lưới mới
    resetSinglePlayerTimer();
});

// Kết nối với nút Clear All
clearAllBtn.addEventListener('click', () => {
    // Reset đồng hồ khi xóa tất cả
    resetSinglePlayerTimer();
});

// Kết nối với nút kiểm tra đáp án
document.getElementById('checkBtn').addEventListener('click', () => {
    const size = parseInt(document.getElementById('gridSize').value);
    const grid = getGridData(size);
    const isCorrect = checkSudokuSolution(grid, size);

    if (isCorrect) {
        alert("Chính xác! Thời gian của bạn: " + timerDisplay.textContent);
        stopSinglePlayerTimer();
    } else {
        alert("Sai rồi!");
    }
});
  

// Mảng chứa 50 lưới Sudoku đã tạo sẵn
let sudokuGrids = [];

let currentSudokuIndex = 0; // Lưu trữ chỉ số của lưới Sudoku hiện tại

// Tạo lưới Sudoku với kích thước tùy chọn và kích thước ô phù hợp
function createSudokuGrid(size) {
    sudokuGrid.innerHTML = ''; // Xóa lưới cũ

    // Cập nhật kích thước ô dựa trên kích thước lưới
    let cellSize;
    if (size === 4) cellSize = 50;
    else if (size === 9) cellSize = 40;
    else if (size === 16) cellSize = 30;
    else {
        console.error("Unsupported grid size!");
        return; // Thoát nếu không hỗ trợ kích thước lưới
    }

    for (let i = 0; i < size; i++) {
        const row = document.createElement('div');
        row.className = 'sudoku-row';

        for (let j = 0; j < size; j++) {
            const cell = document.createElement('input');
            cell.type = 'text';
            cell.className = 'sudoku-cell';
            cell.id = `cell-${i}-${j}`;

            // Cho phép nhập nhiều số nhưng không cho phép ký tự và kiểm tra giá trị hợp lệ
            cell.oninput = function () {
                cell.value = cell.value.replace(/[^0-9]/g, ''); // Loại bỏ ký tự không phải số

                // Chuyển đổi giá trị nhập vào
                const value = parseInt(cell.value);

                // Kiểm tra nếu giá trị không hợp lệ
                if (value > size || value < 1) {
                    alert(`Vui lòng nhập số từ 1 đến ${size}.`);
                    cell.value = ''; // Xóa giá trị không hợp lệ
                }

                // Thay đổi màu nền của ô
                if (cell.value) {
                    cell.style.backgroundColor = 'yellow'; // Chuyển màu ô sang màu vàng khi nhập số
                } else {
                    cell.style.backgroundColor = 'white'; // Trở lại màu trắng khi xóa số
                }
            };

            // Cập nhật kích thước của ô theo giá trị của `cellSize`
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
            cell.style.textAlign = 'center'; // Canh giữa số
            cell.style.fontSize = `${cellSize * 0.7}px`;   // Kích thước chữ nhỏ hơn để vừa với ô

            row.appendChild(cell);
        }

        sudokuGrid.appendChild(row);
    }
}

// Hàm hiển thị một lưới Sudoku từ mảng đã tạo
function displaySudokuGrid(grid, size) {
    createSudokuGrid(size);
    updateGrid(grid, size);
}

// Lấy dữ liệu từ lưới
function getGridData(size) {
    const grid = [];
    for (let i = 0; i < size; i++) {
        const row = [];
        for (let j = 0; j < size; j++) {
            const cell = document.getElementById(`cell-${i}-${j}`);
            const value = cell.value.match(/\d+/); // Lấy số đầu tiên từ chuỗi nếu có
            row.push(value ? parseInt(value[0]) : 0); // Nếu không có số nào, thêm 0
        }
        grid.push(row);
    }
    return grid;
}

// Cập nhật dữ liệu lưới sau khi giải
function updateGrid(grid, size) {
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const cell = document.getElementById(`cell-${i}-${j}`);
            cell.value = grid[i][j] === 0 ? '' : grid[i][j];
        }
    }
}

// Hàm tạo bảng Sudoku hoàn chỉnh
function generateCompleteSudoku(size) {
    const grid = Array.from({ length: size }, () => Array(size).fill(0));

    // Logic khởi tạo bảng Sudoku hoàn chỉnh
    function fillGrid() {
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const subgridSize = Math.sqrt(size);
                let num = (i * subgridSize + Math.floor(i / subgridSize) + j) % size + 1;
                grid[i][j] = num;
            }
        }
    }

    fillGrid(); // Tạo bảng Sudoku hoàn chỉnh
    return grid;
}

// Hoán đổi hàng và cột để xáo trộn bảng Sudoku (giữ nguyên)
function shuffleSudoku(grid, size) {
    const subgridSize = Math.sqrt(size);

    if (!Number.isInteger(subgridSize)) {
        console.warn("Grid size does not support shuffling.");
        return;
    }

    // Hoán đổi ngẫu nhiên các hàng trong từng khối
    for (let i = 0; i < size; i += subgridSize) {
        const rows = [...Array(subgridSize).keys()].map(x => x + i);
        shuffleArray(rows);
        for (let j = 0; j < subgridSize; j++) {
            [grid[i + j], grid[rows[j]]] = [grid[rows[j]], grid[i + j]];
        }
    }

    // Hoán đổi ngẫu nhiên các cột trong từng khối
    for (let i = 0; i < size; i += subgridSize) {
        const cols = [...Array(subgridSize).keys()].map(x => x + i);
        shuffleArray(cols);
        for (let j = 0; j < subgridSize; j++) {
            for (let k = 0; k < size; k++) {
                [grid[k][i + j], grid[k][cols[j]]] = [grid[k][cols[j]], grid[k][i + j]];
            }
        }
    }
}

// Hàm xáo trộn mảng
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Xóa số trong các ô dựa trên độ khó
function removeNumbers(grid, size, percentage) {
    let cellsToRemove = Math.floor(size * size * percentage);
    while (cellsToRemove > 0) {
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        if (grid[row][col] !== 0) {
            grid[row][col] = 0;
            cellsToRemove--;
        }
    }
}

// Tạo 50 lưới Sudoku và lưu vào mảng sudokuGrids
function generateMultipleSudoku(size, difficulty) {
    sudokuGrids = [];
    const difficultyPercentage = { easy: 0.4, medium: 0.5, hard: 0.6 };

    for (let i = 0; i < 50; i++) {
        const grid = generateCompleteSudoku(size);
        shuffleSudoku(grid, size);
        removeNumbers(grid, size, difficultyPercentage[difficulty]);
        sudokuGrids.push(grid); // Thêm lưới vào mảng
    }

    currentSudokuIndex = 0; // Đặt lại chỉ số lưới hiện tại
    displaySudokuGrid(sudokuGrids[currentSudokuIndex], size);
}

// Sự kiện cho nút tạo Sudoku
generateBtn.addEventListener('click', () => {
    const size = parseInt(gridSizeSelect.value);
    const difficulty = difficultySelect.value;
    generateMultipleSudoku(size, difficulty);
});

// Sự kiện cho nút giải Sudoku từ lưới hiện tại
solveBtn.addEventListener('click', () => {
    const size = parseInt(gridSizeSelect.value);
    const grid = getGridData(size);
    if (solveSudoku(grid, size)) {
        updateGrid(grid, size);
    } else {
        alert("This Sudoku puzzle cannot be solved.");
    }
});

// Hàm giải Sudoku (đệ quy)
function solveSudoku(grid, size) {
    const findEmptyCell = () => {
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (grid[i][j] === 0) return [i, j]; // Tìm ô trống
            }
        }
        return null; // Không còn ô trống
    };

    const isValid = (row, col, num) => {
        // Kiểm tra xem số có nằm trong khoảng cho phép hay không
        if (num < 1 || num > size) {
            alert(`Số ${num} không hợp lệ. Vui lòng nhập số từ 1 đến ${size}.`);
            return false; // Số không hợp lệ
        }

        for (let x = 0; x < size; x++) {
            if (grid[row][x] === num || grid[x][col] === num) return false; // Kiểm tra hàng và cột
        }
        const subgridSize = Math.sqrt(size);
        const startRow = row - row % subgridSize;
        const startCol = col - col % subgridSize;
        for (let i = 0; i < subgridSize; i++) {
            for (let j = 0; j < subgridSize; j++) {
                if (grid[i + startRow][j + startCol] === num) return false; // Kiểm tra ô con
            }
        }
        return true; // Số hợp lệ
    };

    const emptyCell = findEmptyCell();
    if (!emptyCell) return true; // Đã giải xong

    const [row, col] = emptyCell;

    for (let num = 1; num <= size; num++) {
        if (isValid(row, col, num)) {
            grid[row][col] = num;

            if (solveSudoku(grid, size)) return true; // Đệ quy giải Sudoku

            grid[row][col] = 0; // Quay lui
        }
    }

    return false; // Không có lời giải
}

// Hàm kiểm tra xem lưới Sudoku có được giải đúng không
function checkSudokuSolution(grid, size) {
    const isValid = (row, col, num) => {
        const subgridSize = Math.sqrt(size);

        // Kiểm tra hàng và cột
        for (let x = 0; x < size; x++) {
            if (grid[row][x] === num && x !== col) return false;
            if (grid[x][col] === num && x !== row) return false;
        }

        // Kiểm tra ô con (subgrid)
        const startRow = row - row % subgridSize;
        const startCol = col - col % subgridSize;
        for (let i = 0; i < subgridSize; i++) {
            for (let j = 0; j < subgridSize; j++) {
                if (grid[startRow + i][startCol + j] === num && (startRow + i !== row || startCol + j !== col)) {
                    return false;
                }
            }
        }

        return true;
    };

    // Kiểm tra tất cả các ô trong lưới
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const num = grid[i][j];
            if (num === 0 || !isValid(i, j, num)) {
                return false;
            }
        }
    }
    return true;
}

// Sự kiện cho nút kiểm tra đáp án
document.getElementById('checkBtn').addEventListener('click', () => {
    const size = parseInt(document.getElementById('gridSize').value);
    const grid = getGridData(size);  // Giả sử bạn có hàm getGridData để lấy dữ liệu lưới Sudoku hiện tại
    const isCorrect = checkSudokuSolution(grid, size);

    if (isCorrect) {
        alert("Chính xác!");
    } else {
        alert("Sai rồi!");
    }
});

// Nút để tạo lưới nhập
createGridBtn.addEventListener('click', () => {
    const size = parseInt(gridSizeSelect.value); // Lấy kích thước lưới hiện tại
    createSudokuGrid(size); // Tạo lưới
    document.getElementById('sudokuInputArea').style.display = 'block'; // Hiện thị vùng nhập liệu
});

// Cập nhật giá trị của phần tử gridSizeValue khi thay đổi kích thước lưới
document.addEventListener('DOMContentLoaded', function() {
    const gridSizeValueSpan = document.getElementById('gridSizeValue');

    gridSizeSelect.addEventListener('change', function() {
        gridSizeValueSpan.textContent = gridSizeSelect.value;
    });
});
