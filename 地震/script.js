var QuakeJson;
var JMAPointsJson;

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
map.createPane("shingen").style.zIndex = 100; //震源
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
        url = "https://api.p2pquake.net/v2/history?codes=551&limit=" + option;
    } else {
        url = "https://api.p2pquake.net/v2/history?codes=551&limit=100";
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
            var maxInt_data = element['earthquake']['maxScale'];
            let maxIntText = hantei_maxIntText(maxInt_data);
            var magnitude = element['earthquake']['hypocenter']['magnitude']
            let Name = hantei_Name(element['earthquake']['hypocenter']['name']);
            let Time = element['earthquake']['time'];
            if (element["issue"]["type"] == "ScalePrompt") {
                text = "【震度速報】" + element["points"][0]["addr"] + "など " + "\n" + Time.slice(0, -3) + "\n最大震度 : " + maxIntText;
            } else if (element["issue"]["type"] == "Foreign") {
                text = "【遠地地震】" + Time.slice(0, -3) + " " + Name;
            } else {
                text = Time.slice(0, -3) + " " + Name + " " + "\n" + "\n最大震度 : " + maxIntText + "\nM" + magnitude;
            }
            option.value = "" + forEachNum + "";
            option.textContent = text;
            document.getElementById('quakelist').appendChild(option);
            forEachNum++;
        });

        //地震情報リストをクリックしたときの発火イベント
        var list = document.getElementById('quakelist');
        list.onchange = event => {
            QuakeSelect(list.selectedIndex);
        }

        QuakeSelect(0);
    });
}

var shingenIcon;
var shindo_icon;
var shindo_layer = L.layerGroup();
function QuakeSelect(num) {
    if (shingenIcon && shindo_layer) {
        map.removeLayer(shingenIcon);
        map.removeLayer(shindo_layer);
        shingenIcon = "";
        shindo_layer = L.layerGroup();
        shindo_icon = "";
    }

    // Destinationの場合は分布や最大震度はnum+1(ScalePrompt)を参照
    let distNum = num;
    if (
        QuakeJson[num]["issue"]["type"] === "Destination" &&
        QuakeJson[num + 1] &&
        QuakeJson[num + 1]["issue"]["type"] === "ScalePrompt"
    ) {
        distNum = num + 1;
    }

    // 最大震度などは分布側(distNum)から取得
    let maxInt_data = QuakeJson[distNum]['earthquake']['maxScale'];
    let maxIntText = hantei_maxIntText(maxInt_data);

    // 震源地情報はDestination側(num)から取得
    var Magnitude = hantei_Magnitude(QuakeJson[num]['earthquake']['hypocenter']['magnitude']);
    var Name = hantei_Name(QuakeJson[num]['earthquake']['hypocenter']['name']);
    var Depth = hantei_Depth(QuakeJson[num]['earthquake']['hypocenter']['depth']);
    var tsunamiText = hantei_tsunamiText(QuakeJson[num]['earthquake']['domesticTsunami']);
    var Time = QuakeJson[num]['earthquake']['time'];

    var shingenLatLng = new L.LatLng(QuakeJson[num]["earthquake"]["hypocenter"]["latitude"], QuakeJson[num]["earthquake"]["hypocenter"]["longitude"]);
    var shingenIconImage = L.icon({
        iconUrl: 'batu.png',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -40]
    });
    shingenIcon = L.marker(shingenLatLng, { icon: shingenIconImage }).addTo(map);
    shingenIcon.bindPopup(
        '発生時刻：' + Time +
        '<br>最大震度：' + maxIntText +
        '<br>震源地：' + Name +
        '<span style="font-size: 85%;"> (' + QuakeJson[num]["earthquake"]["hypocenter"]["latitude"] + ", " + QuakeJson[num]["earthquake"]["hypocenter"]["longitude"] + ')</span>' +
        '<br>規模：M' + Magnitude + '　深さ：' + Depth +
        '<br>受信：' + QuakeJson[num]['issue']['time'] + ', ' + QuakeJson[num]['issue']['source'],
        { closeButton: false, zIndexOffset: 10000, maxWidth: 10000 }
    );
    shingenIcon.on('mouseover', function (e) { this.openPopup(); });
    shingenIcon.on('mouseout', function (e) { this.closePopup(); });

    // 各地の震度に関する情報
    if (QuakeJson[distNum]["issue"]["type"] != "ScalePrompt") {
        QuakeJson[distNum]["points"].forEach(element => {
            var result = JMAPoints.indexOf(element["addr"]);
            if (result != -1) {
                var ImgUrl = "";
                var PointShindo = "";
                var icon_theme = "jqk";
                if (element["scale"] == 10) {
                    ImgUrl = "detail_int/" + icon_theme + "_int1.png";
                    PointShindo = "震度1";
                } else if (element["scale"] == 20) {
                    ImgUrl = "detail_int/" + icon_theme + "_int2.png";
                    PointShindo = "震度2";
                } else if (element["scale"] == 30) {
                    ImgUrl = "detail_int/" + icon_theme + "_int3.png";
                    PointShindo = "震度3";
                } else if (element["scale"] == 40) {
                    ImgUrl = "detail_int/" + icon_theme + "_int4.png";
                    PointShindo = "震度4";
                } else if (element["scale"] == 45) {
                    ImgUrl = "detail_int/" + icon_theme + "_int50.png";
                    PointShindo = "震度5弱";
                } else if (element["scale"] == 46) {
                    ImgUrl = "detail_int/" + icon_theme + "_int54.png";
                    PointShindo = "震度5弱以上と推定";
                } else if (element["scale"] == 50) {
                    ImgUrl = "detail_int/" + icon_theme + "_int55.png";
                    PointShindo = "震度5強";
                } else if (element["scale"] == 55) {
                    ImgUrl = "detail_int/" + icon_theme + "_int60.png";
                    PointShindo = "震度6弱";
                } else if (element["scale"] == 60) {
                    ImgUrl = "detail_int/" + icon_theme + "_int65.png";
                    PointShindo = "震度6強";
                } else if (element["scale"] == 70) {
                    ImgUrl = "detail_int/" + icon_theme + "_int70.png";
                    PointShindo = "震度7";
                } else {
                    ImgUrl = "detail_int/" + icon_theme + "_int100.png";
                    PointShindo = "震度不明";
                }
                if (element["isArea"] == false) { //観測点
                    let shindo_latlng = new L.LatLng(JMAPointsJson[result]["lat"], JMAPointsJson[result]["lon"]);
                    let shindoIcon = L.icon({
                        iconUrl: ImgUrl,
                        iconSize: [20, 20],
                        popupAnchor: [0, -40]
                    });
                    shindo_icon = L.marker(shindo_latlng, { icon: shindoIcon, pane: eval('\"shindo' + element["scale"] + '\"') });
                    shindo_icon.bindPopup('<ruby>' + element["addr"] + '<rt style="font-size: 0.7em;">' + JMAPointsJson[result]["furigana"] + '</rt></ruby>　' + PointShindo, { closeButton: false, zIndexOffset: 10000, autoPan: false, });
                    shindo_icon.on('mouseover', function (e) { this.openPopup(); });
                    shindo_icon.on('mouseout', function (e) { this.closePopup(); });
                    shindo_layer.addLayer(shindo_icon);
                }
            }
        });
    } else {
        QuakeJson[distNum]["points"].forEach(element => {
            var result = AreaName.indexOf(element["addr"]);
            if (result != -1) {
                var ImgUrl = "";
                var PointShindo = "";
                var icon_theme = "";
                if (element["scale"] == 10) {
                    ImgUrl = "int/" + icon_theme + "int1.png";
                    PointShindo = "震度1";
                } else if (element["scale"] == 20) {
                    ImgUrl = "int/" + icon_theme + "int2.png";
                    PointShindo = "震度2";
                } else if (element["scale"] == 30) {
                    ImgUrl = "int/" + icon_theme + "int3.png";
                    PointShindo = "震度3";
                } else if (element["scale"] == 40) {
                    ImgUrl = "int/" + icon_theme + "int4.png";
                    PointShindo = "震度4";
                } else if (element["scale"] == 45) {
                    ImgUrl = "int/" + icon_theme + "int50.png";
                    PointShindo = "震度5弱";
                } else if (element["scale"] == 46) {
                    ImgUrl = "int/" + icon_theme + "int54.png";
                    PointShindo = "震度5弱以上と推定";
                } else if (element["scale"] == 50) {
                    ImgUrl = "int/" + icon_theme + "int55.png";
                    PointShindo = "震度5強";
                } else if (element["scale"] == 55) {
                    ImgUrl = "int/" + icon_theme + "int60.png";
                    PointShindo = "震度6弱";
                } else if (element["scale"] == 60) {
                    ImgUrl = "int/" + icon_theme + "int65.png";
                    PointShindo = "震度6強";
                } else if (element["scale"] == 70) {
                    ImgUrl = "int/" + icon_theme + "int70.png";
                    PointShindo = "震度7";
                } else {
                    ImgUrl = "int/" + icon_theme + "int100.png";
                    PointShindo = "震度不明";
                }
                if (element["isArea"] == true) { //エリア
                    // 画像サイズを条件で変更
                    let iconSize = [20, 20];
                    if (QuakeJson[num]["issue"]["type"] === "Destination") {
                        iconSize = [30, 30];
                    }
                    let shindo_latlng = new L.LatLng(getNthValue(centerPoint, result, "lat"), getNthValue(centerPoint, result, "lng"));
                    let shindoIcon = L.icon({
                        iconUrl: ImgUrl,
                        iconSize: iconSize,
                        popupAnchor: [0, -40]
                    });
                    shindo_icon = L.marker(shindo_latlng, { icon: shindoIcon, pane: eval('\"shindo' + element["scale"] + '\"') });
                    shindo_icon.bindPopup('<ruby>' + element["addr"] + '<rt style="font-size: 0.7em;">' + getNthValue(AreaKana, result, "key") + '</rt></ruby>　' + PointShindo, { closeButton: false, zIndexOffset: 10000, autoPan: false, });
                    shindo_icon.on('mouseover', function (e) { this.openPopup(); });
                    shindo_icon.on('mouseout', function (e) { this.closePopup(); });
                    shindo_layer.addLayer(shindo_icon);

                    function getNthValue(centerPoint, n, key) {
                        const values = Object.values(centerPoint);
                        if (n < 0 || n > values.length || (key !== "lat" && key !== "lng")) {
                            return values[n];
                        }
                        return values[n][key];
                    }
                }
            }
        });
    }

    // 地図の中心・縮尺調整
    if (QuakeJson[distNum]["issue"]["type"] == "ScalePrompt") {
        magnification = 8.5;
    } else if (QuakeJson[distNum]["issue"]["type"] == "Foreign") {
        magnification = 5;
    } else {
        magnification = 8.5;
    }

    // 震源と観測点の座標を集める
    let latlngs = [];
    // 震源
    latlngs.push([
        Number(QuakeJson[num]["earthquake"]["hypocenter"]["latitude"]),
        Number(QuakeJson[num]["earthquake"]["hypocenter"]["longitude"])
    ]);
    // 観測点
    if (QuakeJson[distNum]["issue"]["type"] != "ScalePrompt") {
        QuakeJson[distNum]["points"].forEach(element => {
            var result = JMAPoints.indexOf(element["addr"]);
            if (result != -1 && JMAPointsJson[result]) {
                latlngs.push([
                    Number(JMAPointsJson[result]["lat"]),
                    Number(JMAPointsJson[result]["lon"])
                ]);
            }
        });
    } else {
        QuakeJson[distNum]["points"].forEach(element => {
            var result = AreaName.indexOf(element["addr"]);
            if (result != -1 && typeof getNthValue === "function") {
                let lat = Number(getNthValue(centerPoint, result, "lat"));
                let lng = Number(getNthValue(centerPoint, result, "lng"));
                if (!isNaN(lat) && !isNaN(lng)) {
                    latlngs.push([lat, lng]);
                }
            }
        });
    }

    // 重心を計算
    let avgLat = latlngs.reduce((sum, cur) => sum + cur[0], 0) / latlngs.length;
    let avgLng = latlngs.reduce((sum, cur) => sum + cur[1], 0) / latlngs.length;

    map.addLayer(shindo_layer);

    // バウンディングボックスを計算
    let lats = latlngs.map(ll => ll[0]);
    let lngs = latlngs.map(ll => ll[1]);
    let southWest = L.latLng(Math.min(...lats), Math.min(...lngs));
    let northEast = L.latLng(Math.max(...lats), Math.max(...lngs));
    let bounds = L.latLngBounds(southWest, northEast);

    // DetailScaleまたはDestinationのときはfitBoundsで自動調整
    if (QuakeJson[distNum]["issue"]["type"] === "DetailScale") {
        let maxZoom = 9;
        map.fitBounds(bounds, { maxZoom: maxZoom, padding: [50, 50] });
    } else if (QuakeJson[num]["issue"]["type"] === "Destination") {
        let maxZoom = 7.5;
        map.fitBounds(bounds, { maxZoom: maxZoom, padding: [50, 50] })
    } else if (QuakeJson[distNum]["issue"]["type"] == "ScalePrompt") {
        map.flyTo(new L.LatLng(35, 137), 5, { duration: 0.5 });
    } else {
        map.flyTo(new L.LatLng(avgLat, avgLng), magnification, { duration: 0.5 });
    }

    // UI更新
    document.getElementById('int').innerText = maxIntText;
    let element = document.getElementById("max_int");
    // maxIntTextの値に応じて背景色を変更
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

    let TsunamiElement = document.getElementById("tsunamiwarning");
    if (QuakeJson[num]['earthquake']['domesticTsunami'] === "Warning") {
        TsunamiElement.style.display = "block";
    } else {
        TsunamiElement.style.display = "none";
    }

    document.getElementById("time").innerText = Time.slice(0, -3) + "頃";
    document.getElementById("place").innerText = Name;
    document.getElementById("magnitude").innerText = "M" + Magnitude;
    document.getElementById("depth").innerText = Depth;
    document.getElementById("tsunami").innerText = tsunamiText;
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
