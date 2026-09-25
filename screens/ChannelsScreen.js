import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { getLiveStreams, getStreamUrl } from '../api/xtream';

export default function ChannelsScreen({ route, navigation }) {
  const { creds, categoryId, categoryName } = route.params;

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigation.setOptions({
      title: categoryName,
    });

    getLiveStreams(creds, categoryId)
      .then(setChannels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [categoryId, categoryName, creds, navigation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>خطأ: {error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={channels}
      keyExtractor={(item) => String(item.stream_id)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            navigation.navigate('Player', {
              streamUrl: getStreamUrl(creds, item.stream_id),
              channelName: item.name,
            })
          }
        >
          {item.stream_icon ? (
            <Image
              source={{ uri: item.stream_icon }}
              style={styles.logo}
            />
          ) : (
            <View style={styles.logoPlaceholder} />
          )}

          <Text style={styles.itemText}>
            {item.name}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  error: {
    color: 'red',
    fontSize: 16,
  },

  list: {
    padding: 12,
  },

  item: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },

  logo: {
    width: 36,
    height: 36,
    marginLeft: 10,
    borderRadius: 6,
  },

  logoPlaceholder: {
    width: 36,
    height: 36,
    marginLeft: 10,
    borderRadius: 6,
    backgroundColor: '#333',
  },

  itemText: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
    textAlign: 'right',
  },
});
