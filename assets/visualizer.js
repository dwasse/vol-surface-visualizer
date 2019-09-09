var websocketIp = "127.0.0.1";
var websocketPort = "9000";
var pair = document.currentScript.getAttribute("pair");
var currency = pair.split("/")[0];
console.log("Got pair " + pair + ", currency " + currency);
var optionData = {};
var optionsByName = {};
var minDelta = parseFloat(document.getElementById("minDelta").value);
var maxDelta = parseFloat(document.getElementById("maxDelta").value);
var minStrike = parseFloat(document.getElementById("minStrike").value);
var maxStrike = parseFloat(document.getElementById("maxStrike").value);
var minVol = parseFloat(document.getElementById("minVol").value);
var maxVol = parseFloat(document.getElementById("maxVol").value);
var minDays = parseFloat(document.getElementById("minDays").value);
var maxDays = parseFloat(document.getElementById("maxDays").value);
// var callVols = [];
var callVols = {};
var callDeltas = [];
var callTimes = [];
var callStrikes = [];
// var putVols = [];
var putVols = {};
var putDeltas = [];
var putTimes = [];
var putStrikes = [];
var xAxisName;
var xCallData;
var xPutData;
var callTrace;
var putTrace;
var callLayout;
var putLayout;

var callContainer = document.getElementById("callGraph");
var putContainer = document.getElementById("putGraph");
var callGraph = null;
var putGraph = null;
var callGraphData = null;
var putGraphData = null;

var strikeView = false;
var liveData = false;
var currentTimestamp = new Date().getTime();

numberSort = function(a, b) {
  return a - b;
};

reverseNumberSort = function(a, b) {
  return b - a;
};

function sendDataPOST(requestData) {
  return new Promise(function(resolve, reject) {
    var data = new FormData();
    for (var key in requestData) {
      data.append(key, requestData[key]);
    }
    var request = new XMLHttpRequest();
    var url = window.location.href;
    request.open("POST", url, true);
    request.responseType = "text";
    request.onload = async function() {
      var responseData = JSON.parse(request.response);
      console.log(responseData);
      if (responseData["status"] === "SUCCESS") {
        resolve(responseData);
      } else {
        reject(responseData);
      }
    };
    request.send(data);
  });
}

async function getOptionData() {
  let requestData = {
    action: "getOptionData",
    pair: pair
  };
  let responseData = await sendDataPOST(requestData);
  if (responseData["status"] === "SUCCESS") {
    optionData = responseData["data"];
    optionsByName = {};
    for (var i = 0; i < optionData.length; i++) {
      option = optionData[i];
      optionsByName[option["symbol"]] = option;
    }
    plotVolSurface();
  }
}

function parseOptionData() {
  minDelta = parseFloat(document.getElementById("minDelta").value);
  maxDelta = parseFloat(document.getElementById("maxDelta").value);
  minStrike = parseFloat(document.getElementById("minStrike").value);
  maxStrike = parseFloat(document.getElementById("maxStrike").value);
  minVol = parseFloat(document.getElementById("minVol").value);
  maxVol = parseFloat(document.getElementById("maxVol").value);
  minDays = parseFloat(document.getElementById("minDays").value);
  maxDays = parseFloat(document.getElementById("maxDays").value);
  callTimes = [];
  callDeltas = [];
  callVols = {};
  callStrikes = [];
  putTimes = [];
  putDeltas = [];
  putVols = {};
  putStrikes = [];

  for (var key in optionsByName) {
    data = optionsByName[key];
    var expiryParts;
    if (data["expiry"].includes(" ")) {
      expiryParts = data["expiry"].split(" ")[0].split("-");
    } else {
      var expiryParts = data["expiry"].split("-");
    }
    var date = new Date(expiryParts[0], expiryParts[1] - 1, expiryParts[2]);
    var days = (date.getTime() - currentTimestamp) / (86400 * 1000);
    var delta = parseFloat(data["delta"]);
    var vol = parseFloat(data["vol"]);
    var strike = parseInt(data["strike"]);
    if (
      vol > minVol &&
      vol < maxVol &&
      Math.abs(delta) > minDelta &&
      Math.abs(delta) < maxDelta &&
      strike > minStrike &&
      strike < maxStrike &&
      days > minDays &&
      days < maxDays
    ) {
      if (delta > 0) {
        callDeltas.unshift(delta);
        callStrikes.unshift(strike);
        callTimes.unshift(days);
        if (!(days in callVols)) {
          callVols[days] = {};
        }
        if (strikeView) {
          callVols[days][strike] = vol;
        } else {
          callVols[days][delta] = vol;
        }
      } else if (delta < 0) {
        putDeltas.unshift(delta);
        putStrikes.unshift(strike);
        putTimes.unshift(days);
        if (!(days in putVols)) {
          putVols[days] = {};
        }
        if (strikeView) {
          putVols[days][strike] = vol;
        } else {
          putVols[days][delta] = vol;
        }
      }
    }
  }
  callDeltas.sort(numberSort);
  callStrikes.sort(numberSort);
  callTimes.sort(numberSort);
  putDeltas.sort(reverseNumberSort);
  putStrikes.sort(reverseNumberSort);
  putTimes.sort(numberSort);
}

function unpack(rows, key) {
  return rows.map(function(row) {
    return row[key];
  });
}

function getVolByDelta(delta, time) {
  if (delta > 0) {
    var vol = callVols[time][delta];
    if (!vol) {
      if (!callVols[time][delta]) {
        // Get nearest vol
        var deltaArray = Object.keys(callVols[time]);
        var closestDelta = deltaArray.reduce(function(prev, curr) {
          return Math.abs(curr - delta) < Math.abs(prev - delta) ? curr : prev;
        });
        vol = callVols[time][closestDelta];
      }
    }
  }
  if (delta < 0) {
    var vol = putVols[time][delta];
    if (!vol) {
      if (!putVols[time][delta]) {
        // Get nearest vol
        var deltaArray = Object.keys(putVols[time]);
        if (deltaArray.length > 0) {
          var closestDelta = deltaArray.reduce(function(prev, curr) {
            return Math.abs(curr - delta) < Math.abs(prev - delta)
              ? curr
              : prev;
          });
          vol = putVols[time][closestDelta];
        }
      }
    }
  }
  return vol;
}

function getVolByStrike(strike, delta, time) {
  if (delta > 0) {
    var vol = callVols[time][strike];
    if (!vol) {
      if (!callVols[time][strike]) {
        // Get nearest vol
        var strikeArray = Object.keys(callVols[time]);
        var closestStrike = strikeArray.reduce(function(prev, curr) {
          return Math.abs(curr - strike) < Math.abs(prev - strike)
            ? curr
            : prev;
        });
        vol = callVols[time][closestStrike];
      }
    }
  }
  if (delta < 0) {
    var vol = putVols[time][strike];
    if (!vol) {
      if (!putVols[time][strike]) {
        // Get nearest vol
        var strikeArray = Object.keys(putVols[time]);
        if (strikeArray.length > 0) {
          var closestStrike = strikeArray.reduce(function(prev, curr) {
            return Math.abs(curr - strike) < Math.abs(prev - strike)
              ? curr
              : prev;
          });
          vol = putVols[time][closestStrike];
        }
      }
    }
  }
  return vol;
}

function plotVolSurface(update = false) {
  parseOptionData();
  var xAxisName;
  var xCallData;
  var xPutData;
  if (strikeView) {
    xAxisName = "Strike";
    xCallData = callStrikes;
    xPutData = putStrikes;
  } else {
    xAxisName = "Delta";
    xCallData = callDeltas;
    xPutData = putDeltas;
  }
  callGraphData = new vis.DataSet();
  for (i = 0; i < callDeltas.length; i++) {
    var delta = callDeltas[i];
    var xData = xCallData[i];
    for (j = 0; j < callTimes.length; j++) {
      var yData = callTimes[j];
      var zData;
      if (strikeView) {
        zData = getVolByStrike(xData, delta, yData);
      } else {
        zData = getVolByDelta(delta, yData);
      }
      callGraphData.add({
        x: xData,
        y: yData,
        z: zData,
        style: zData
      });
    }
  }
  var options = {
    width: "100%",
    height: "100%",
    style: "surface",
    showPerspective: true,
    showGrid: true,
    showShadow: false,
    keepAspectRatio: false,
    verticalRatio: 0.9,
    xLabel: xAxisName,
    yLabel: "Days to Expiration",
    zLabel: "Volatility",
    zValueLabel: function(z) {
      return parseInt(z) + "%";
    }
  };
  putGraphData = new vis.DataSet();
  for (i = 0; i < putDeltas.length; i++) {
    var delta = putDeltas[i];
    var xData = xPutData[i];
    for (j = 0; j < putTimes.length; j++) {
      var yData = putTimes[j];
      var zData;
      if (strikeView) {
        zData = getVolByStrike(xData, delta, yData);
      } else {
        zData = getVolByDelta(delta, yData);
      }
      putGraphData.add({
        x: xData,
        y: yData,
        z: zData,
        style: zData
      });
    }
  }
  var options = {
    width: "600px",
    height: "600px",
    style: "surface",
    showPerspective: true,
    showGrid: true,
    showShadow: false,
    keepAspectRatio: false,
    verticalRatio: 0.9,
    xLabel: xAxisName,
    yLabel: "Days to Expiration",
    zLabel: "Volatility",
    zValueLabel: function(z) {
      return parseInt(z) + "%";
    }
  };
  if (update) {
    try {
      callGraph.setData(callGraphData);
    } catch (err) {
      console.log("Error plotting call graph: " + err.message);
    }
    try {
      putGraph.setData(putGraphData);
    } catch (err) {
      console.log("Error plotting put graph: " + err.message);
    }
  } else {
    callGraph = new vis.Graph3d(callContainer, callGraphData, options);
    putGraph = new vis.Graph3d(putContainer, putGraphData, options);
  }
}

function refresh(e) {
  var code = e.keyCode ? e.keyCode : e.which;
  if (code == 13) {
    parseOptionData();
    plotVolSurface(true);
  }
}

function switchViews() {
  var viewSwitch = document.getElementById("viewSwitch");
  if (viewSwitch.checked) {
    strikeView = true;
  } else {
    strikeView = false;
  }
  plotVolSurface();
}

function switchLiveData() {
  var liveDataSwitch = document.getElementById("liveDataSwitch");
  if (liveDataSwitch.checked) {
    connectLiveData();
  } else {
    disconnectLiveData();
  }
}

function processOptionUpdate(dataString) {
  var data = JSON.parse(dataString);
  if (data["Symbol"].includes(currency)) {
    optionsByName[data["Symbol"]] = data;
    parseOptionData();
    plotVolSurface(true);
  } else {
  }
}

var socket = null;
var isopen = false;

function connectLiveData() {
  getOptionData();
  console.log("Connecting websocket...");
  socket = new WebSocket("ws://" + websocketIp + ":" + websocketPort);
  socket.binaryType = "arraybuffer";

  socket.onopen = function() {
    console.log("Connected to " + websocketIp + ":" + websocketPort + "!");
    isopen = true;
    socket.send(
      JSON.stringify({
        action: "subscribe",
        currency: currency
      })
    );
    console.log(
      "Sent subscription request: " +
        JSON.stringify({
          action: "subscribe",
          currency: currency
        })
    );
  };

  socket.onmessage = function(e) {
    if (typeof e.data == "string") {
      console.log("Received option update: " + e.data);
      processOptionUpdate(e.data);
    } else {
      var arr = new Uint8Array(e.data);
      var hex = "";
      for (var i = 0; i < arr.length; i++) {
        hex += ("00" + arr[i].toString(16)).substr(-2);
      }
    }
  };

  socket.onclose = function(e) {
    console.log("Connection closed.");
    socket = null;
    isopen = false;
  };
}

function disconnectLiveData() {
  console.log("Closing websocket...");
  if (socket) {
    socket.close();
  }
}

function sendText() {
  if (isopen) {
    socket.send("Hello, world!");
    console.log("Text message sent.");
  } else {
    console.log("Connection not opened.");
  }
}

function sendBinary() {
  if (isopen) {
    var buf = new ArrayBuffer(32);
    var arr = new Uint8Array(buf);
    for (i = 0; i < arr.length; ++i) arr[i] = i;
    socket.send(buf);
    console.log("Binary message sent.");
  } else {
    console.log("Connection not opened.");
  }
}

getOptionData();
