import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

export type MapPlace = {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m?: number;
};

type Props = {
  latitude?: number | null;
  longitude?: number | null;
  places?: MapPlace[];
  height?: number;
};

function buildHtml(lat: number, lng: number): string {
  const la = lat.toFixed(6);
  const ln = lng.toFixed(6);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0}#m{background:#0d1626}</style>
</head><body><div id="m"></div><script>
var map=L.map('m').setView([${la},${ln}],15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var mk=L.circleMarker([${la},${ln}],{radius:8,color:'#ffffff',weight:2,fillColor:'#2563eb',fillOpacity:1}).addTo(map);
var extra=[];
window.updateMap=function(lat,lng,places){
  mk.setLatLng([lat,lng]); map.setView([lat,lng],map.getZoom(),{animate:false});
  extra.forEach(function(x){map.removeLayer(x)}); extra=[];
  (places||[]).forEach(function(p){
    extra.push(L.circle([p.latitude,p.longitude],{radius:p.radius_m||150,color:'#10b981',weight:2,fillOpacity:0.08}).addTo(map));
    extra.push(L.marker([p.latitude,p.longitude]).bindTooltip(p.name).addTo(map));
  });
};
</script></body></html>`;
}

export default function ChildMap({ latitude, longitude, places = [], height = 240 }: Props) {
  const ref = useRef<WebView>(null);
  const loaded = useRef(false);
  const hasLoc = typeof latitude === 'number' && typeof longitude === 'number';

  const payload = useMemo(
    () => JSON.stringify({ lat: latitude, lng: longitude, places }),
    [latitude, longitude, places],
  );

  const send = () => {
    if (!loaded.current || !hasLoc) return;
    const js = 'window.updateMap(' + payload + ');true;';
    ref.current?.injectJavaScript(js);
  };
  useEffect(send, [payload, hasLoc]);

  if (!hasLoc) {
    return (
      <View style={[styles.wrap, { height }]}>
        <Text style={styles.placeholder}>📍 لا يوجد موقع بعد — بانتظار أول تحديث من جهاز الطفل</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html: buildHtml(latitude as number, longitude as number) }}
        onLoadEnd={() => { loaded.current = true; send(); }}
        style={styles.map}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', marginTop: 8, backgroundColor: '#0d1626' },
  map: { flex: 1 },
  placeholder: { color: '#94a3b8', textAlign: 'center', marginTop: 40, fontSize: 12 },
});
