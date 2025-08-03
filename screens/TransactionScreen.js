import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TransactionScreen({ navigation }) {
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');

  const handleTransaction = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      // Ganti dengan URL API Laravel kamu
      const response = await fetch('http://YOUR_LARAVEL_API_URL/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ item_id: itemId, quantity }),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Sukses', 'Transaksi berhasil');
        setItemId('');
        setQuantity('');
      } else {
        Alert.alert('Error', 'Transaksi gagal');
      }
    } catch (error) {
      Alert.alert('Error', 'Terjadi kesalahan, coba lagi');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buat Transaksi</Text>
      <TextInput
        style={styles.input}
        placeholder="ID Barang"
        value={itemId}
        onChangeText={setItemId}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Jumlah"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
      />
      <Button title="Submit Transaksi" onPress={handleTransaction} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, borderRadius: 5 },
});