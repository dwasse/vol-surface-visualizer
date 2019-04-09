

var optionData = {};
// var minVol = .1;
// var maxVol = 2;
// var minDelta = .1;
// var maxDelta = .5;
var minDelta = parseFloat(document.getElementById("minDelta").value);
var maxDelta = parseFloat(document.getElementById("maxDelta").value);
var minVol = parseFloat(document.getElementById("minVol").value);
var maxVol = parseFloat(document.getElementById("maxVol").value);
var call_vols = [];
var call_deltas = [];
var call_times = [];
var put_vols = [];
var put_deltas = [];
var put_times = [];


function sendDataPOST(requestData) {
  return new Promise(function(resolve, reject) {
    console.log('sending POST data: ' + JSON.stringify(requestData));
    var data = new FormData();
    for (var key in requestData) {
      data.append(key, requestData[key]);
    }
    var request = new XMLHttpRequest();
    var url = window.location.href;
    request.open('POST', url, true);
    request.responseType = 'text';
    request.onload = async function() {
      var responseData = JSON.parse(request.response);
      console.log(responseData);
      if (responseData['status'] === 'SUCCESS') {
        console.log("Response data success: " + JSON.stringify(responseData));
        resolve(responseData);
      } else {
        reject(responseData);
      }
  };
  request.send(data);
  })
}


async function getOptionData() {
  let requestData = {
    "action": "getOptionData",
    "pair": "BTC/USD"
  }
  let responseData = await sendDataPOST(requestData);
  if (responseData['status'] === 'SUCCESS') {
  	optionData = responseData['data'];
  	plotVolSurface();
  }
}

function parseOptionData() {
	minDelta = parseFloat(document.getElementById("minDelta").value);
	maxDelta = parseFloat(document.getElementById("maxDelta").value);
	minVol = parseFloat(document.getElementById("minVol").value);
	maxVol = parseFloat(document.getElementById("maxVol").value);
	console.log("Min delta: " + minDelta + ", max delta: " + maxDelta + ", min vol: " + minVol + ", max vol: " + maxVol);
	call_times = [];
	call_deltas = [];
	call_vols = [];
	put_times = [];
	put_deltas = [];
	put_vols = [];
	var currentTimestamp = new Date().getTime();
	for (var i = 0; i < optionData.length; i++) {
		data = optionData[i];
		var expiryParts = data['expiry'].split('-');
		var date = new Date(expiryParts[0], expiryParts[1] - 1, expiryParts[2]);
		var daysToExpiration = (date.getTime() - currentTimestamp) / (86400 * 1000);
		var delta = parseFloat(data['delta']);
		var vol = parseFloat(data['vol']);
		// console.log("Days to expiration: " + daysToExpiration + ", delta: " + delta + ", vol: " + vol)
		if (vol > minVol && vol < maxVol && Math.abs(delta) > minDelta && Math.abs(delta) < maxDelta) {
			if (delta > 0) {
				call_times.unshift(daysToExpiration);
				call_deltas.unshift(delta);
				call_vols.unshift(vol);
			} else if (delta < 0) {
				put_times.unshift(daysToExpiration);
				put_deltas.unshift(delta);
				put_vols.unshift(vol);
			}
		}
	}
}

function unpack(rows, key) {
  return rows.map(function(row) { return row[key]; });
}

function plotVolSurface(update=false) {
  console.log("Parsing option data");
  parseOptionData();
  console.log("Plotting vol surface");
  var call_trace = {
  	type: 'mesh3d',
  	opacity: 0.5,
    color: 'rgba(255,127,80,0.7)',
  	x: call_deltas,
  	y: call_times,
  	z: call_vols,
  }
  var put_trace = {
  	type: 'mesh3d',
  	opacity: 0.5,
    color:'rgb(00,150,200)',
  	x: put_deltas,
  	y: put_times,
  	z: put_vols,
  }
  var call_layout = {
    // title: {
    // 	text: "Calls",
    // 	font: {
    // 		size: 40
    // 	},
    // },
    font: {
    	color: '#ffffff'
    },
    paper_bgcolor:"black",
    width: 1000,
    height: 750,
    margin: {
      l: 65,
      r: 50,
      b: 0,
      t: 0,
    },
    scene: {
    	xaxis: {
	    	title: {
	    		text:'Delta',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
	    yaxis: {
	    	title: {
	    		text: 'Days to Expiration',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
	    zaxis: {
	    	title: {
	    		text: 'Volatility',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
    }
  };
  var put_layout = {
    // title: {
    // 	text: "Puts",
    // 	font: {
    // 		size: 40
    // 	},
    // },
    font: {
    	color: '#ffffff'
    },
    paper_bgcolor:"black",
    width: 1000,
    height: 750,
    margin: {
      l: 65,
      r: 50,
      b: 0,
      t: 0,
    },
    scene: {
    	xaxis: {
	    	title: {
	    		text:'Delta',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
	    yaxis: {
	    	title: {
	    		text: 'Days to Expiration',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
	    zaxis: {
	    	title: {
	    		text: 'Volatility',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
    }
  };
  var options = {
  	displayModeBar: false
  };
  if (update) {
  	Plotly.react('calls', [call_trace], call_layout, options);
  	Plotly.react('puts', [put_trace], put_layout, options);
  } else {
  	Plotly.newPlot('calls', [call_trace], call_layout, options);
    Plotly.newPlot('puts', [put_trace], put_layout, options);
  }
  console.log("Plotted vol surface");
}

function refresh(e) {
	var code = (e.keyCode ? e.keyCode : e.which);
	if (code == 13) {
		console.log("Enter press detected, searching...");
		parseOptionData();
		plotVolSurface(true);
	}
}


getOptionData();
