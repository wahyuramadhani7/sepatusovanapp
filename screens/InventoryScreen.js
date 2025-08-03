import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function InventoryScreen() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', stock: '' });
  const [editItem, setEditItem] = useState(null);

  // Fetch items from API
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          Alert.alert('Error', 'Silakan login terlebih dahulu');
          return;
        }
        const response = await fetch('http://192.168.1.6:8000/api/products/', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) throw new Error('Gagal mengambil data produk');
        const data = await response.json();
        setItems(data);
      } catch (error) {
        console.error('Error fetching inventory:', error);
        Alert.alert('Error', 'Gagal mengambil data produk');
      }
    };
    fetchItems();
  }, []);

  // Handle adding new item
  const handleAddItem = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Silakan login terlebih dahulu');
        return;
      }
      const response = await fetch('http://192.168.1.6:8000/api/products/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newItem),
      });
      if (!response.ok) throw new Error('Gagal menambah produk');
      const addedItem = await response.json();
      setItems([...items, addedItem]);
      setNewItem({ name: '', stock: '' });
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Gagal menambah produk');
    }
  };

  // Handle updating item
  const handleUpdateItem = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Silakan login terlebih dahulu');
        return;
      }
      const response = await fetch(`http://192.168.1.6:8000/api/products/${editItem.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editItem),
      });
      if (!response.ok) throw new Error('Gagal memperbarui produk');
      const updatedItem = await response.json();
      setItems(items.map(item => (item.id === updatedItem.id ? updatedItem : item)));
      setEditItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Gagal memperbarui produk');
    }
  };

  // Handle deleting item
  const handleDeleteItem = async (id) => {
    Alert.alert(
      'Konfirmasi',
      'Apakah Anda yakin ingin menghapus item ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) {
                Alert.alert('Error', 'Silakan login terlebih dahulu');
                return;
              }
              const response = await fetch(`http://192.168.1.6:8000/api/products/${id}/`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              if (!response.ok) throw new Error('Gagal menghapus produk');
              setItems(items.filter(item => item.id !== id));
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Gagal menghapus produk');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daftar Inventory</Text>

      {/* Add/Edit Form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nama Produk"
          value={editItem ? editItem.name : newItem.name}
          onChangeText={(text) =>
            editItem
              ? setEditItem({ ...editItem, name: text })
              : setNewItem({ ...newItem, name: text })
          }
        />
        <TextInput
          style={styles.input}
          placeholder="Stok"
          keyboardType="numeric"
          value={editItem ? editItem.stock.toString() : newItem.stock}
          onChangeText={(text) =>
            editItem
              ? setEditItem({ ...editItem, stock: text })
              : setNewItem({ ...newItem, stock: text })
          }
        />
        <Button
          title={editItem ? 'Simpan Perubahan' : 'Tambah Produk'}
          onPress={editItem ? handleUpdateItem : handleAddItem}
        />
        {editItem && (
          <Button title="Batal" color="gray" onPress={() => setEditItem(null)} />
        )}
      </View>

      {/* Item List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>
              {item.name} - Stok: {item.stock}
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                title="Edit"
                onPress={() => setEditItem(item)}
                color="#f0ad4e"
              />
              <Button
                title="Hapus"
                onPress={() => handleDeleteItem(item.id)}
                color="#d9534f"
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  form: { marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    backgroundColor: '#fff',
    marginBottom: 5,
    borderRadius: 5,
  },
  buttonContainer: { flexDirection: 'row', gap: 10 },
});
