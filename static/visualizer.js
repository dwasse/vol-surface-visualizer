var symbol = document.currentScript.getAttribute("symbol");
var currency = symbol.split("/")[0];
console.log("Got symbol " + symbol + ", currency " + currency);
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
const cols = ['symbol', 'strike', 'expiry', 'vol', 'delta', 'gamma', 'theta', 'vega']

numberSort = function(a, b) {
  return a - b;
};

reverseNumberSort = function(a, b) {
  return b - a;
};

function httpGetAsync(theUrl, callback)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous 
    xmlHttp.send(null);
}

async function getOptionData() {
  var url = "http://localhost:5000/api/vol_data/" + symbol
  console.log("Got url: " + url)
  httpGetAsync(url, function(data){
    console.log("Got vol data: " + JSON.stringify(data));
    var jsonData = JSON.parse(data)
    optionData = jsonData["data"];
    console.log("Option data: " + JSON.stringify(optionData));
    optionsByName = {};
    for (var i = 0; i < optionData.length; i++) {
      option = optionData[i];
      symbol = option[cols.indexOf("symbol")]
      console.log("Got symbol:  " + symbol)
      optionsByName[symbol] = option;
    }
    plotVolSurface();
  })
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
    expiry = parseInt(data[cols.indexOf("expiry")])
    delta = parseFloat(data[cols.indexOf("delta")])
    vol = parseFloat(data[cols.indexOf("vol")]) 
    strike = parseFloat(data[cols.indexOf("strike")])
    gamma = parseFloat(data[cols.indexOf("gamma")])
    theta = parseFloat(data[cols.indexOf("theta")])
    vega = parseFloat(data[cols.indexOf("vega")])
    console.log("Data: " + data)
    console.log("Delta: " + delta)
    console.log("Vol: " + vol)
    var days = (expiry - currentTimestamp) / (86400 * 1000);
    console.log("Days: " + days)
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
  console.log("Call deltas: " + callDeltas)
  console.log("call strikes: " + callStrikes)
  console.log("Call vols: " + callVols)
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
    console.log("Call graph data: " + JSON.stringify(callGraphData));
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


getOptionData();
