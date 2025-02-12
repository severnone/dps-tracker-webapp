const BOT_URL = 'https://api.telegram.org/bot7589897746:AAEhL_zFWcC6iPtz_i2CmeQO4YL4j3rZ3V4';
let tg = window.Telegram.WebApp;
let startTime = Date.now();
let watchId = null;

// Инициализация
tg.expand();
tg.ready();

// Настройки звука
let soundSettings = {
    enabled: true,
    volume: 1.0
};

// Настройки по умолчанию
let settings = {
    soundEnabled: true,
    soundVolume: 1.0
};

// Загрузка настроек
function loadSettings() {
    const saved = localStorage.getItem('dpsTrackerSettings');
    if (saved) {
        soundSettings = JSON.parse(saved);
        document.getElementById('soundEnabled').checked = soundSettings.enabled;
        document.getElementById('soundVolume').value = soundSettings.volume;

        // Показываем/скрываем регулятор громкости
        document.getElementById('volumeControl').style.display =
            soundSettings.enabled ? 'flex' : 'none';
    }
}

// Сохранение настроек
function saveSettings() {
    soundSettings.enabled = document.getElementById('soundEnabled').checked;
    soundSettings.volume = parseFloat(document.getElementById('soundVolume').value);

    localStorage.setItem('dpsTrackerSettings', JSON.stringify(soundSettings));

    // Показываем/скрываем регулятор громкости
    document.getElementById('volumeControl').style.display =
        soundSettings.enabled ? 'flex' : 'none';
}

// Функция для отправки данных боту
async function sendDataToBot(data) {
    try {
        console.log('Sending data to bot:', data);
        const response = await fetch(`${BOT_URL}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: tg.initDataUnsafe.user.id,
                text: `webapp_data:${JSON.stringify(data)}`
            })
        });
        
        const result = await response.json();
        console.log('Response from bot:', result);
    } catch (e) {
        console.error('Error sending data to bot:', e);
    }
}

// Запуск отслеживания
function startTracking() {
    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
            handlePosition,
            handleError,
            {
                enableHighAccuracy: true,
                timeout: 27000,
                maximumAge: 0
            }
        );
    }
}

// Обработка полученной позиции
function handlePosition(position) {
    console.log('Got position:', position);
    const accuracy = Math.round(position.coords.accuracy);
    document.getElementById('accuracy').textContent =
        `Точность: ${accuracy}м`;

    const data = {
        type: 'location',
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: accuracy,
        timestamp: position.timestamp
    };

    // Отправляем данные боту
    sendDataToBot(data);

    // Обновляем статус
    document.getElementById('trackingStatus').innerHTML =
        `Статус: <span class="active">Отслеживание активно</span>`;
}

// Остановка отслеживания
function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;

        document.getElementById('trackingStatus').innerHTML =
            `Статус: <span class="inactive">Отслеживание остановлено</span>`;

        // Отправляем сообщение боту
        const data = {
            type: 'tracking_stopped',
            timestamp: Date.now()
        };
        sendDataToBot(data);

        // Закрываем WebApp
        setTimeout(() => tg.close(), 1000);
    }
}

// Обработка ошибок геолокации
function handleError(error) {
    console.error('Geolocation error:', error);
    let errorMessage = 'Ошибка определения локации: ';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage += 'доступ запрещен';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage += 'позиция недоступна';
            break;
        case error.TIMEOUT:
            errorMessage += 'таймаут запроса';
            break;
        default:
            errorMessage += 'неизвестная ошибка';
    }

    document.getElementById('trackingStatus').innerHTML =
        `Статус: <span class="error">${errorMessage}</span>`;

    // Отправляем ошибку боту
    const data = {
        type: 'error',
        message: errorMessage,
        timestamp: Date.now()
    };
    sendDataToBot(data);
}

// Воспроизведение звука
async function playAlert(distance) {
    if (!soundSettings.enabled) return;

    try {
        // Сначала звук предупреждения
        const warning = new Audio('alerts/warning.mp3');
        warning.volume = soundSettings.volume;
        await warning.play();

        // Ждем окончания предупреждения
        await new Promise(resolve => {
            warning.onended = resolve;
        });

        // Затем голосовое сообщение
        const distanceFile = distance >= 1000 ? '1000m.mp3' : `${Math.floor(distance)}m.mp3`;
        const voice = new Audio(`alerts/${distanceFile}`);
        voice.volume = soundSettings.volume;
        await voice.play();

    } catch (e) {
        console.error('Error playing audio:', e);
    }
}

// Обновление времени работы
function updateTrackingTime() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    document.getElementById('trackingTime').textContent =
        `Время работы: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Обработчики событий
document.getElementById('stopTracking').onclick = stopTracking;
document.getElementById('soundEnabled').onchange = saveSettings;
document.getElementById('soundVolume').onchange = saveSettings;

// Запуск приложения
loadSettings();
startTracking();
setInterval(updateTrackingTime, 1000);

// Обработка сообщений от бота
tg.onEvent('message', function(event) {
    console.log('Received message from bot:', event);
    try {
        const data = JSON.parse(event.data);
        console.log('Parsed message data:', data);

        if (data.type === 'dps_alert') {
            console.log('Playing alert sound for distance:', data.distance);
            playAlert(data.distance);
        }
    } catch (e) {
        console.error('Error processing message:', e);
    }
});