// app.js
// ==================== Инициализация Telegram Web App ====================
const tg = window.Telegram.WebApp;
tg.expand(); // Разворачиваем на весь экран
tg.enableClosingConfirmation(); // Подтверждение закрытия

// Определяем тему Telegram (если нужно применить)
if (tg.colorScheme === 'dark') {
    document.body.classList.add('dark');
} else {
    document.body.classList.remove('dark');
}

// ==================== DOM элементы ====================
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const suggestionsDiv = document.getElementById('suggestions');
const loader = document.getElementById('loader');
const weatherContent = document.getElementById('weatherContent');
const errorDiv = document.getElementById('errorMessage');
const themeToggle = document.getElementById('themeToggle');

// Элементы отображения погоды
const cityNameSpan = document.getElementById('cityName');
const conditionSpan = document.getElementById('condition');
const tempMainSpan = document.getElementById('tempMain');
const feelsLikeSpan = document.getElementById('feelsLike');
const weatherIconSpan = document.getElementById('weatherIcon');
const humiditySpan = document.getElementById('humidity');
const pressureSpan = document.getElementById('pressure');
const windSpan = document.getElementById('wind');
const precipSpan = document.getElementById('precip');
const hourlyContainer = document.getElementById('hourlyContainer');
const dailyContainer = document.getElementById('dailyContainer');

// ==================== Состояние ====================
let currentCity = { lat: 55.7558, lon: 37.6173, name: 'Москва' }; // По умолчанию Москва
let abortController = null;

// ==================== Вспомогательные функции ====================
function showLoader(show) {
    if (show) {
        loader.classList.remove('hidden');
        weatherContent.classList.add('hidden');
        errorDiv.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    weatherContent.classList.add('hidden');
    setTimeout(() => errorDiv.classList.add('hidden'), 4000);
}

// Перевод направления ветра (градусы -> румб)
function getWindDirection(deg) {
    const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
    return dirs[Math.round(deg / 45) % 8];
}

// Получение иконки погоды по коду WMO (Open-Meteo)
function getWeatherIcon(wmoCode, isDay = true) {
    const icons = {
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
        51: '🌦️', 53: '🌧️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
        61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌨️', 67: '🌨️',
        71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️', 80: '🌧️',
        81: '🌧️', 82: '🌧️', 85: '❄️', 86: '❄️', 95: '⛈️',
        96: '⛈️', 99: '⛈️'
    };
    return icons[wmoCode] || (isDay ? '🌡️' : '🌙');
}

// Описание погоды по WMO
function getWeatherDescription(wmoCode) {
    const desc = {
        0: 'Ясно', 1: 'В основном ясно', 2: 'Переменная облачность', 3: 'Пасмурно',
        45: 'Туман', 48: 'Туман', 51: 'Морось', 53: 'Морось', 55: 'Сильная морось',
        61: 'Дождь', 63: 'Дождь', 65: 'Сильный дождь', 71: 'Снег', 73: 'Снег',
        75: 'Сильный снег', 80: 'Ливень', 81: 'Ливень', 82: 'Сильный ливень',
        95: 'Гроза', 96: 'Гроза с градом', 99: 'Сильная гроза'
    };
    return desc[wmoCode] || 'Облачно';
}

// Давление из гПа в мм рт. ст.
function hPaToMmHg(hPa) {
    return Math.round(hPa * 0.750062);
}

// ==================== Поиск города через Nominatim (OpenStreetMap) ====================
async function searchCity(query) {
    if (!query || query.length < 2) return [];
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&accept-language=ru`
        );
        const data = await response.json();
        return data.map(item => ({
            name: item.display_name.split(',')[0],
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            fullName: item.display_name
        }));
    } catch (error) {
        console.error('Ошибка поиска города:', error);
        return [];
    }
}

// Отображение подсказок
function showSuggestions(suggestions) {
    suggestionsDiv.innerHTML = '';
    if (suggestions.length === 0) {
        suggestionsDiv.classList.add('hidden');
        return;
    }
    suggestions.forEach(city => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = city.name;
        div.addEventListener('click', () => {
            cityInput.value = city.name;
            currentCity = { lat: city.lat, lon: city.lon, name: city.name };
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.add('hidden');
            fetchWeatherData(currentCity.lat, currentCity.lon);
        });
        suggestionsDiv.appendChild(div);
    });
    suggestionsDiv.classList.remove('hidden');
}

// Обработчик ввода поиска с debounce
let searchTimeout;
cityInput.addEventListener('input', async (e) => {
    const val = e.target.value.trim();
    if (searchTimeout) clearTimeout(searchTimeout);
    if (val.length < 2) {
        suggestionsDiv.classList.add('hidden');
        return;
    }
    searchTimeout = setTimeout(async () => {
        const cities = await searchCity(val);
        showSuggestions(cities);
    }, 400);
});

searchBtn.addEventListener('click', async () => {
    const val = cityInput.value.trim();
    if (!val) return;
    const cities = await searchCity(val);
    if (cities.length > 0) {
        currentCity = { lat: cities[0].lat, lon: cities[0].lon, name: cities[0].name };
        fetchWeatherData(currentCity.lat, currentCity.lon);
    } else {
        showError('Город не найден. Попробуйте другой запрос.');
    }
    suggestionsDiv.classList.add('hidden');
});

// ==================== Запрос погоды через Open-Meteo ====================
async function fetchWeatherData(lat, lon) {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    showLoader(true);
    
    try {
        // Основной API Open-Meteo: текущая, почасовой, 7 дней
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,weathercode,windspeed_10m,winddirection_10m,pressure_msl&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
        
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) throw new Error('Ошибка сети');
        const data = await response.json();
        
        updateCurrentWeather(data);
        updateHourlyForecast(data);
        updateDailyForecast(data);
        
        weatherContent.classList.remove('hidden');
        showLoader(false);
    } catch (err) {
        if (err.name === 'AbortError') return;
        console.error(err);
        // Резервное метео: Meteostat нет прямого CORS, используем Open-Meteo с другим эндпоинтом или просто сообщение
        showError('Не удалось загрузить данные. Проверьте соединение.');
        showLoader(false);
    }
}

// Обновление текущей погоды
function updateCurrentWeather(data) {
    const current = data.current_weather;
    const wmoCode = current.weathercode;
    const isDay = true; // Open-Meteo current_weather не даёт is_day просто, можно по времени, но упростим
    const icon = getWeatherIcon(wmoCode, true);
    const condition = getWeatherDescription(wmoCode);
    
    cityNameSpan.textContent = currentCity.name;
    conditionSpan.textContent = condition;
    tempMainSpan.textContent = `${Math.round(current.temperature)}°`;
    feelsLikeSpan.textContent = `Ощущается как ${Math.round(current.temperature)}°`; // Упрощённо
    weatherIconSpan.textContent = icon;
    
    // Находим влажность и давление из почасовых (ближайший час)
    const now = new Date();
    const currentHourISO = now.toISOString().slice(0, 13) + ':00';
    const hourlyIndex = data.hourly.time.findIndex(t => t === currentHourISO);
    let humidity = '--%', pressureMm = '-- мм', windDir = '', precipProb = '--%';
    
    if (hourlyIndex !== -1) {
        humidity = `${data.hourly.relativehumidity_2m[hourlyIndex]}%`;
        const pressureHpa = data.hourly.pressure_msl[hourlyIndex];
        pressureMm = `${hPaToMmHg(pressureHpa)} мм`;
        precipProb = `${data.hourly.precipitation_probability[hourlyIndex]}%`;
        const windDeg = data.hourly.winddirection_10m[hourlyIndex];
        windDir = getWindDirection(windDeg);
    }
    
    const windSpeed = `${Math.round(current.windspeed)} м/с ${windDir}`;
    
    humiditySpan.textContent = humidity;
    pressureSpan.textContent = pressureMm;
    windSpan.textContent = windSpeed;
    precipSpan.textContent = precipProb;
}

// Почасовой прогноз (на сегодня, до 24 часов)
function updateHourlyForecast(data) {
    hourlyContainer.innerHTML = '';
    const now = new Date();
    const currentHour = now.getHours();
    const times = data.hourly.time;
    const temps = data.hourly.temperature_2m;
    const codes = data.hourly.weathercode;
    const precipProbs = data.hourly.precipitation_probability;
    
    // Показываем следующие 24 часа (максимум до конца дня или 24 записи)
    let startIdx = times.findIndex(t => new Date(t).getHours() >= currentHour);
    if (startIdx === -1) startIdx = 0;
    const endIdx = Math.min(startIdx + 24, times.length);
    
    for (let i = startIdx; i < endIdx; i++) {
        const time = new Date(times[i]);
        const hourStr = time.getHours().toString().padStart(2, '0') + ':00';
        const temp = Math.round(temps[i]);
        const icon = getWeatherIcon(codes[i], true);
        const prob = precipProbs[i];
        
        const hourCard = document.createElement('div');
        hourCard.className = 'hour-card';
        hourCard.innerHTML = `
            <div class="hour-time">${hourStr}</div>
            <div class="hour-icon">${icon}</div>
            <div class="hour-temp">${temp}°</div>
            <div style="font-size:12px;">🌧️ ${prob}%</div>
        `;
        hourlyContainer.appendChild(hourCard);
    }
}

// Прогноз на 7 дней
function updateDailyForecast(data) {
    dailyContainer.innerHTML = '';
    const days = data.daily.time;
    const maxTemps = data.daily.temperature_2m_max;
    const minTemps = data.daily.temperature_2m_min;
    const codes = data.daily.weathercode;
    const precipProbs = data.daily.precipitation_probability_max;
    
    const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    
    for (let i = 0; i < days.length && i < 7; i++) {
        const date = new Date(days[i]);
        const weekday = weekdays[date.getDay()];
        const dayName = i === 0 ? 'Сегодня' : weekday;
        const maxTemp = Math.round(maxTemps[i]);
        const minTemp = Math.round(minTemps[i]);
        const icon = getWeatherIcon(codes[i], true);
        const precip = precipProbs[i];
        
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        dayCard.innerHTML = `
            <span class="day-name">${dayName}</span>
            <span class="day-icon">${icon}</span>
            <div class="day-temp">
                <span class="max-temp">${maxTemp}°</span>
                <span class="min-temp">${minTemp}°</span>
            </div>
            <span style="font-size:13px;">💧${precip}%</span>
        `;
        dailyContainer.appendChild(dayCard);
    }
}

// ==================== Автоматическое обновление (каждые 10 минут) ====================
let autoUpdateInterval;
function startAutoUpdate() {
    if (autoUpdateInterval) clearInterval(autoUpdateInterval);
    autoUpdateInterval = setInterval(() => {
        if (currentCity.lat && currentCity.lon) {
            fetchWeatherData(currentCity.lat, currentCity.lon);
        }
    }, 10 * 60 * 1000);
}

// ==================== Тема (светлая/тёмная) ====================
function initTheme() {
    const savedTheme = localStorage.getItem('weatherTheme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    } else if (savedTheme === 'light') {
        document.body.classList.remove('dark');
    } else {
        // По умолчанию как у Telegram
        if (tg.colorScheme === 'dark') document.body.classList.add('dark');
    }
}

themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('weatherTheme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
});

// ==================== Старт приложения ====================
async function init() {
    initTheme();
    startAutoUpdate();
    // Загружаем погоду для Москвы по умолчанию
    await fetchWeatherData(55.7558, 37.6173);
    // Обработка закрытия mini app
    tg.ready();
}

init();