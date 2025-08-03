import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VisitorScreen() {
  const [visitors, setVisitors] = useState([]);

  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        // Ganti dengan URL API Laravel kamu
        const response = await fetch('http://YOUR_LARAVEL_API_URL/visitors', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setVisitors(data); // Asumsi API mengembalikan array [{id, date, count}, ...]
      } catch (error) {
        console.error('Error fetching visitors:', error);
      }
    };
    fetchVisitors();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monitoring Pengunjung</Text>
      <FlatList
        data={visitors}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>Tanggal: {item.date} - Jumlah: {item.count}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  item: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' },
});