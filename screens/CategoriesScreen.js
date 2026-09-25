import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getLiveCategories, clearCredentials } from '../api/xtream';

export default function CategoriesScreen({ route, navigation }) {
  const { creds } = route.params;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={async () => {
            await clearCredentials();
            navigation.replace('Login');
          }}
        >
          <Text style={{ color: '#1e90ff', marginRight: 12 }}>
            خروج
          </Text>
        </TouchableOpacity>
      ),
    });

    getLiveCategories(creds)
      .then(setCategories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigation, creds]);

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
      data={categories}
      keyExtractor={(item) => String(item.category_id)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() =>
            navigation.navigate('Channels', {
              creds,
              categoryId: item.category_id,
              categoryName: item.category_name,
            })
          }
        >
          <Text style={styles.itemText}>
            {item.category_name}
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
    backgroundColor: '#1c1c1e',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
  },

  itemText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'right',
  },
});
