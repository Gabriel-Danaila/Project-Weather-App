const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.get("/weather", (req, res) => {
  const { lat, lon, city } = req.query;

  if (city) {
    getWeatherByCity(res, city);
  } else if (lat && lon) {
    getWeatherByCoordinates(res, lat, lon);
  } else {
    res.sendStatus(400);
  }
});

function getWeatherByCity(res, city) {
  axios
    .get("https://api.openweathermap.org/data/2.5/weather", {
      params: {
        q: city,
        appid: process.env.API_KEY,
        units: "metric",
      },
    })
    .then(({ data }) => {
      const { coord } = data;
      if (!coord) {
        console.log("Error: Unable to retrieve coordinates for city.");
        res.sendStatus(500);
        return;
      }
      getWeatherByCoordinates(res, coord.lat, coord.lon);
    })
    .catch((e) => {
      console.log(e);
      res.sendStatus(500);
    });
}

function getWeatherByCoordinates(res, lat, lon) {
  axios
    .get("https://api.openweathermap.org/data/3.0/onecall", {
      params: {
        lat,
        lon,
        appid: process.env.API_KEY,
        units: "metric",
        exclude: "minutely,alerts",
      },
    })
    .then(({ data }) => {
      const current = parseCurrentWeather(data);
      const daily = parseDailyWeather(data);
      const hourly = parseHourlyWeather(data);

      if (current === null || daily === null || hourly === null) {
        // One or more of the data could not be parsed correctly.
        // Send an error response.
        res.sendStatus(500);
      } else {
        res.json({ current, daily, hourly });
      }
    })
    .catch((e) => {
      console.log(e);
      res.sendStatus(500);
    });
}

function parseCurrentWeather({ current, daily }) {
  if (
    !current ||
    !current.weather ||
    !current.weather[0] ||
    !daily ||
    !daily[0]
  ) {
    console.log("Error: Unexpected API response format in parseCurrentWeather");
    return null;
  }
  const { temp: currentTemp, weather, wind_speed } = current;
  const { pop, temp, feels_like } = daily[0];

  return {
    currentTemp: Math.round(currentTemp),
    highTemp: Math.round(temp.max),
    lowTemp: Math.round(temp.min),
    highFeelsLike: Math.round(Math.max(...Object.values(feels_like))),
    lowFeelsLike: Math.round(Math.min(...Object.values(feels_like))),
    windSpeed: Math.round(wind_speed),
    precip: Math.round(pop * 100),
    icon: weather[0].icon,
    description: weather[0].description,
  };
}

function parseDailyWeather({ daily }) {
  if (!daily || !Array.isArray(daily) || daily.length < 1) {
    console.log("Error: Unexpected API response format in parseDailyWeather");
    return [];
  }
  return daily.slice(1).map((day) => {
    return {
      timestamp: day.dt * 1000,
      icon: day.weather[0].icon,
      temp: Math.round(day.temp.day),
    };
  });
}

const HOUR_IN_SECONDS = 3600;
function parseHourlyWeather({ hourly, current }) {
  if (!hourly || !Array.isArray(hourly) || hourly.length < 1 || !current) {
    console.log("Error: Unexpected API response format in parseHourlyWeather");
    return [];
  }
  return hourly
    .filter((hour) => hour.dt > current.dt - HOUR_IN_SECONDS)
    .map((hour) => {
      return {
        timestamp: hour.dt * 1000,
        icon: hour.weather[0].icon,
        temp: Math.round(hour.temp),
        feelsLike: Math.round(hour.feels_like),
        windSpeed: Math.round(hour.wind_speed),
        precip: Math.round(hour.pop * 100),
      };
    });
}

app.listen(3000, () => {
  console.log("Server is ON  and running on port 3000");
});
