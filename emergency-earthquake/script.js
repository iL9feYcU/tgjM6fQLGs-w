var QuakeJson;
var JMAPointsJson;

// 追加: 地図表示用グローバル変数
var shingenIcon = null;
var shindo_layer = L.layerGroup();
var shindo_icon = null;

var map = L.map('map').setView([36.575, 137.984], 6);
L.control.scale({ maxWidth: 150, position: 'bottomright', imperial: false }).addTo(map);
map.zoomControl.setPosition('topright');

//地図に表示させる上下の順番
map.createPane("pane_map1").style.zIndex = 1; //地図（背景）
map.createPane("pane_map2").style.zIndex = 2; //地図（市町村）
map.createPane("pane_map3").style.zIndex = 3; //地図（細分）
map.createPane("pane_map_filled").style.zIndex = 5; //塗りつぶし
map.createPane("shindo10").style.zIndex = 10;
map.createPane("shindo20").style.zIndex = 20;
map.createPane("shindo30").style.zIndex = 30;
map.createPane("shindo40").style.zIndex = 40;
map.createPane("shindo45").style.zIndex = 45;
map.createPane("shindo46").style.zIndex = 46;
map.createPane("shindo50").style.zIndex = 50;
map.createPane("shindo55").style.zIndex = 55;
map.createPane("shindo60").style.zIndex = 60;
map.createPane("shindo70").style.zIndex = 70;
map.createPane("shingen").style.zIndex = 10; //震源
map.createPane("tsunami_map").style.zIndex = 110; //津波

var PolygonLayer_Style_nerv = {
    "color": "#6b5140",
    "weight": 3,
    "opacity": 1,
    "fillColor": "#a68d79",
    "fillOpacity": 1
}

$.getJSON("combined.geojson", function (data) {
    L.geoJson(data, {
        pane: "pane_map3",
        style: PolygonLayer_Style_nerv
    }).addTo(map);
});

$.getJSON("JMAstations.json", function (data) {
    JMAPointsJson = data;
    GetQuake();
});

//ボタン押下時のイベント設定とローカルストレージの設定
document.getElementById('reload').addEventListener("click", () => {
    if (document.getElementById('reload_num').value != "") {
        if (document.getElementById('reload_num').value > 100 || document.getElementById('reload_num').value <= 0) {
            GetQuake(100);
        } else {
            GetQuake(document.getElementById('reload_num').value);
        }
    } else {
        GetQuake();
    }
    document.getElementById('reload').innerText = "更新中…";
    setTimeout(() => {
        document.getElementById('reload').innerText = "更新完了";
        setTimeout(() => {
            document.getElementById('reload').innerText = "情報更新";
        }, 1000);
    }, 1000);
});

function GetQuake(option) {
    var url;
    if (!isNaN(option)) {
        url = "https://api.p2pquake.net/v2/history?codes=556&limit=" + option;
    } else {
        url = "https://api.p2pquake.net/v2/history?codes=556&limit=100";
    }
    $.getJSON(url, function (data) {
        QuakeJson = data;

        while (document.getElementById('quakelist').lastChild) {
            document.getElementById('quakelist').removeChild(document.getElementById('quakelist').lastChild);
        }

        var forEachNum = 0;
        data.forEach(element => {
            var option = document.createElement("option");
            var text;
            let Name = hantei_Name(element['earthquake']['hypocenter']['name']);
            let Time = element['earthquake']['originTime'];
            let magnitude = element['earthquake']['hypocenter']['magnitude'];
            // areas配列の最初の要素を使用
            let area = element.areas[0];
            let scaleFrom = area.scaleFrom;
            let scaleTo = area.scaleTo;
            text = Time.slice(0, -3) + " " + Name + " " + area.name + " M" + magnitude;
            option.value = "" + forEachNum + "";
            option.textContent = text;
            document.getElementById('quakelist').appendChild(option);
            forEachNum++;
        });

        var list = document.getElementById('quakelist');
        list.onchange = event => {
            QuakeSelect(list.selectedIndex);
        }

        QuakeSelect(0);
    });
}

// scale値を次の震度値に進める関数
function nextScale(scale) {
    const scaleOrder = [10, 20, 30, 40, 45, 50, 55, 60, 70, 99];
    let idx = scaleOrder.indexOf(scale);
    if (idx === -1 || idx === scaleOrder.length - 1) return scale + 1;
    return scaleOrder[idx + 1];
}

function QuakeSelect(num) {
    // 既存の震源マーカーを削除
    if (shingenIcon) {
        map.removeLayer(shingenIcon);
        shingenIcon = null;
    }
    // 既存の震度マーカーを削除
    if (shindo_layer) {
        map.removeLayer(shindo_layer);
        shindo_layer = L.layerGroup();
        map.addLayer(shindo_layer);
    }
    shindo_icon = null;

    let quake = QuakeJson[num];

    // --- 最大震度の計算 ---
    // 全てのscaleFrom, scaleToを集めて99を除外し最大値を取得
    let scales = [];
    quake.areas.forEach(area => {
        if (area.scaleFrom !== 99) scales.push(area.scaleFrom);
        if (area.scaleTo !== 99) scales.push(area.scaleTo);
    });
    let maxScale = scales.length > 0 ? Math.max(...scales) : 99;
    let maxIntText = hantei_maxIntText(maxScale);

    let area = quake.areas[0];
    let scaleFrom = area.scaleFrom;
    let scaleTo = area.scaleTo;
    let Name = hantei_Name(quake['earthquake']['hypocenter']['name']);
    let Magnitude = hantei_Magnitude(quake['earthquake']['hypocenter']['magnitude']);
    let Depth = hantei_Depth(quake['earthquake']['hypocenter']['depth']);
    let Time = quake['issue']['time'];

    // 震源地マーカー（今まで通り表示）
    var shingenLatLng = new L.LatLng(quake["earthquake"]["hypocenter"]["latitude"], quake["earthquake"]["hypocenter"]["longitude"]);
    var shingenIconImage = L.icon({
        iconUrl: 'batu.png',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -40]
    });


    // areas配列の各地点に震度画像を表示
    quake.areas.forEach(area => {
        // AreaName配列から一致するindexを取得
        const idx = AreaName.indexOf(area.name);
        if (idx === -1) {
            console.warn("該当地点がAreaNameに見つかりません:", area.name);
            return;
        }
        // AreaCode配列から番号を取得
        const code = AreaCode[idx];
        if (!code) {
            console.warn("該当地点のAreaCodeが見つかりません:", area.name);
            return;
        }
        // centerPointから緯度経度を取得
        const cp = centerPoint[code];
        if (!cp) {
            console.warn("該当地点のcenterPointが見つかりません:", area.name, code);
            return;
        }
        const latlng = new L.LatLng(cp.lat, cp.lng);

        // 震度画像生成
        let scaleImages = [];
        scaleImages.push("int/int" + area.scaleFrom + ".png");
        if (area.scaleTo !== area.scaleFrom) {
            scaleImages.push("int/int" + area.scaleTo + ".png");
        }
        let html = '<div style="display: flex; align-items: center;">';
        scaleImages.forEach(url => {
            html += `<img src="${url}" style="width:25px;height:25px;margin-right:0px;">`;
        });
        html += '</div>';

        // 震度ごとにpaneを指定（z-indexはHTML側で作成済み）
        // 例: 震度4なら"shindo40"、5弱なら"shindo45"など
        // area.scaleTo優先でpane名を決定
        let paneName = "shindo" + area.scaleTo;
        if (!map.getPane(paneName)) {
            // 念のためpaneがなければ作成
            map.createPane(paneName);
        }

        let shindoIcon = L.divIcon({
            html: html,
            iconSize: [scaleImages.length * 32, 32],
            className: ''
        });
        let marker = L.marker(latlng, { icon: shindoIcon, pane: paneName }).addTo(map);
        marker.bindPopup(area.name, { closeButton: false, zIndexOffset: 10000, maxWidth: 300 });
        marker.on('mouseover', function (e) { this.openPopup(); });
        marker.on('mouseout', function (e) { this.closePopup(); });
        shindo_layer.addLayer(marker);
    });

    // 震源マーカーは最前面の"shingen" paneを指定
    shingenIcon = L.marker(shingenLatLng, { icon: shingenIconImage, pane: "shingen" }).addTo(map);
    shingenIcon.bindPopup(
        '発生時刻：' + Time +
        '<br>震源地：' + Name +
        '<span style="font-size: 85%;"> (' + quake["earthquake"]["hypocenter"]["latitude"] + ", " + quake["earthquake"]["hypocenter"]["longitude"] + ')</span>' +
        '<br>規模：M' + Magnitude + '　深さ：' + Depth,
        { closeButton: false, zIndexOffset: 10000, maxWidth: 10000 }
    );
    shingenIcon.on('mouseover', function (e) { this.openPopup(); });
    shingenIcon.on('mouseout', function (e) { this.closePopup(); });

    // --- 地図の中心・縮尺調整（重心＆自動ズーム） ---
    // 震源＋観測点の座標を集める
    let latlngs = [];
    // 震源
    latlngs.push([
        Number(quake["earthquake"]["hypocenter"]["latitude"]),
        Number(quake["earthquake"]["hypocenter"]["longitude"])
    ]);
    // 観測点
    quake.areas.forEach(area => {
        const idx = AreaName.indexOf(area.name);
        if (idx === -1) return;
        const code = AreaCode[idx];
        if (!code) return;
        const cp = centerPoint[code];
        if (!cp) return;
        latlngs.push([Number(cp.lat), Number(cp.lng)]);
    });

    // 重心を計算
    let avgLat = latlngs.reduce((sum, cur) => sum + cur[0], 0) / latlngs.length;
    let avgLng = latlngs.reduce((sum, cur) => sum + cur[1], 0) / latlngs.length;

    // バウンディングボックスを計算
    let lats = latlngs.map(ll => ll[0]);
    let lngs = latlngs.map(ll => ll[1]);
    let southWest = L.latLng(Math.min(...lats), Math.min(...lngs));
    let northEast = L.latLng(Math.max(...lats), Math.max(...lngs));
    let bounds = L.latLngBounds(southWest, northEast);

    // fitBoundsで自動調整（最大ズーム8）
    map.fitBounds(bounds, { maxZoom: 8, padding: [50, 50] });

    // UI更新（ここはそのまま）
    document.getElementById('int').innerText = maxIntText;
    let element = document.getElementById("max_int");
    if (maxIntText === "1") {
        element.style.backgroundColor = "#00a1ff";
        element.style.color = "black";
    } else if (maxIntText === "2") {
        element.style.backgroundColor = "#60d937";
        element.style.color = "black";
    } else if (maxIntText === "3") {
        element.style.backgroundColor = "#ffea00";
        element.style.color = "black";
    } else if (maxIntText === "4") {
        element.style.backgroundColor = "#fe9400";
        element.style.color = "black";
    } else if (maxIntText === "5弱") {
        element.style.backgroundColor = "#b51800";
        element.style.color = "white";
    } else if (maxIntText === "5強") {
        element.style.backgroundColor = "#b51800";
        element.style.color = "white";
    } else if (maxIntText === "6弱") {
        element.style.backgroundColor = "#f9d3e0";
        element.style.color = "#b51800";
    } else if (maxIntText === "6強") {
        element.style.backgroundColor = "#f9d3e0";
        element.style.color = "#b51800";
    } else if (maxIntText === "7") {
        element.style.backgroundColor = "#b51800";
        element.style.color = "white";
    } else {
        element.style.backgroundColor = "#9f9f9f";
        element.style.color = "black";
    }

    let int_element = document.getElementById("int")
    if (maxIntText === "不明") {
        int_element.style.fontSize = "0.7em";
    } else {
        int_element.style.fontSize = "6vw";
    }

    let maxIntElement = document.getElementById("max_int");
    if (maxIntText === "7") {
        maxIntElement.style.border = "8px solid #fdfb42";
    } else {
        maxIntElement.style.border = "none";
    }

    const intElement = document.getElementById('int');
    const intText = intElement.textContent;
    const modifiedText = intText.replace(/(弱|強)/g, '<span style="font-size: 0.7em;">$1</span>');
    intElement.innerHTML = modifiedText;

    document.getElementById("time").innerText = Time;
    document.getElementById("place").innerText = Name;
    document.getElementById("magnitude").innerText = "M" + Magnitude + "（予測）";
    document.getElementById("depth").innerText = Depth;
    document.getElementById("tsunami").innerText = "";
}


function hantei_maxIntText(param) {
    let kaerichi = param == 10 ? "1" : param == 20 ? "2" : param == 30 ? "3" : param == 40 ? "4" :
        param == 45 ? "5弱" : param == 46 ? "5弱" : param == 50 ? "5強" : param == 55 ? "6弱" :
            param == 60 ? "6強" : param == 70 ? "7" : "不明";
    return kaerichi;
}
function hantei_Magnitude(param) {
    let kaerichi = param != -1 ? param.toFixed(1) : 'ー.ー';
    return kaerichi;
}
function hantei_Name(param) {
    let kaerichi = param != "" ? param : '情報なし';
    return kaerichi;
}
function hantei_Depth(param) {
    let kaerichi = param == -1 ? "不明" : param == 0 ? "ごく浅く" : "約" + param + "km";
    return kaerichi;
}
function hantei_tsunamiText(param) {
    let kaerichi = param == "None" ? "津波の心配なし" :
        param == "Unknown" ? "津波不明" :
            param == "Checking" ? "津波調査中" :
                param == "NonEffective" ? "津波被害の心配なし" :
                    param == "Watch" ? "津波注意報" :
                        param == "Warning" ? "" : "情報なし";
    return kaerichi;
}

//申し訳ないが要素を消す
document.querySelector('.leaflet-control-attribution.leaflet-control').remove();
document.querySelector('.leaflet-top.leaflet-right').remove();