import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function PlayerScreen({ route }) {
  const { streamUrl, channelName } = route.params;

  const player = useVideoPlayer(streamUrl, (p) => {
    p.play();
  });

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        allowsFullscreen
        nativeControls
      />

      <Text style={styles.title}>{channelName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  video: {
    flex: 1,
  },

  title: {
    color: '#fff',
    textAlign: 'center',
    padding: 10,
    fontSize: 14,
  },
});
