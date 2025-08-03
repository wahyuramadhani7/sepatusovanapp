import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash'; // Pastikan lodash diinstal: npm install lodash

export default function InventoryScreen() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeTerm, setSizeTerm] = useState('');
  const [newItem, setNewItem] = useState({ name: '', stock: '', size: '', color: '', selling_price: '', discount_price: '' });
  const [editItem, setEditItem] = useState(null);
  const [brandCounts, setBrandCounts] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sanitasi string untuk mencegah unterminated string literal
  const sanitizeString = (str) => {
    return (str || '').replace(/['"]/g, '').replace(/\n/g, '');
  };

  // Debounce search handler
  const debouncedSearch = useCallback(
    debounce((search, size) => {
      if (search.length < 2 && size.length < 1) {
        Alert.alert('Error', 'Kata kunci brand atau model minimal 2 karakter atau masukkan ukuran.');
        return;
      }
      setCurrentPage(1);
      setProducts([]);
      setErrorMessage('');
      fetchProducts(sanitizeString(search), sanitizeString(size), 1);
    }, 500),
    []
  );

  // Fetch products
  const fetchProducts = useCallback(async (search = '', size = '', page = 1, append = false) => {
    if (isLoading || (page !== 1 && isFetchingMore)) return;
    page === 1 ? setIsLoading(true) : setIsFetchingMore(true);

    try {
      console.log(`Fetching products: search=${search}, size=${size}, page=${page}, append=${append}`);
      const cacheKey = `products_${sanitizeString(search)}_${sanitizeString(size)}_${page}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        console.log('Using cached data for:', cacheKey);
        const { products: cachedProducts, pagination } = JSON.parse(cachedData);
        setProducts(prev => (append ? [...prev, ...cachedProducts] : cachedProducts));
        setCurrentPage(pagination.current_page);
        setLastPage(pagination.last_page);
        updateBrandCounts(append ? [...products, ...cachedProducts] : cachedProducts);
        page === 1 ? setIsLoading(false) : setIsFetchingMore(false);
        return;
      }

      const token = await AsyncStorage.getItem('token');
      console.log('Token:', token || 'No token found');
      if (!token) {
        setErrorMessage('Silakan login terlebih dahulu');
        Alert.alert('Error', 'Silakan login terlebih dahulu');
        page === 1 ? setIsLoading(false) : setIsFetchingMore(false);
        return;
      }

      const url = new URL('http://192.168.1.6:8000/api/products/');
      if (search) url.searchParams.set('search', search);
      if (size) url.searchParams.set('size', size);
      url.searchParams.set('page', page);
      url.searchParams.set('per_page', '50');
      console.log('API URL:', url.toString());

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        throw new Error(`Gagal mengambil data: ${response.status} ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Respons API bukan JSON');
      }

      const data = await response.json();
      console.log('API response:', JSON.stringify(data, null, 2));

      let productData = data.data?.products || [];
      let pagination = data.data?.pagination || { current_page: page, last_page: 1 };

      if (!Array.isArray(productData)) {
        console.error('Expected array in data.products, got:', productData);
        throw new Error('Data produk dari API tidak valid');
      }

      const validProducts = productData.filter(
        product => product && product.id && product.name && typeof product.stock === 'number'
      );

      if (validProducts.length === 0 && productData.length > 0) {
        console.warn('No valid products after filtering:', productData);
        setErrorMessage('Tidak ada produk valid ditemukan');
      }

      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ products: validProducts, pagination })
      );

      setProducts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newProducts = validProducts.filter(p => !existingIds.has(p.id));
        return append ? [...prev, ...newProducts] : newProducts;
      });

      setCurrentPage(pagination.current_page);
      setLastPage(pagination.last_page);
      updateBrandCounts(append ? [...products, ...validProducts] : validProducts);
    } catch (error) {
      console.error('Error fetching products:', error.message);
      setErrorMessage(error.message || 'Gagal mengambil data produk');
      Alert.alert('Error', error.message || 'Gagal mengambil data produk');
    } finally {
      page === 1 ? setIsLoading(false) : setIsFetchingMore(false);
    }
  }, [products, isLoading, isFetchingMore]);

  // Update brand counts
  const updateBrandCounts = useCallback((productList) => {
    const counts = {};
    productList.forEach(product => {
      const brand = sanitizeString(product.brand) || 'Unknown';
      counts[brand] = (counts[brand] || 0) + (product.stock || 0);
    });
    setBrandCounts(counts);
  }, []);

  // Handle search
  const handleSearch = () => {
    debouncedSearch(searchTerm, sizeTerm);
  };

  // Handle adding new product
  const handleAddItem = async () => {
    try {
      if (!newItem.name || !newItem.stock || !newItem.selling_price) {
        Alert.alert('Error', 'Nama, stok, dan harga jual wajib diisi');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Silakan login terlebih dahulu');
        return;
      }

      const [brand, ...modelParts] = sanitizeString(newItem.name).split(' ');
      const model = modelParts.join(' ') || '';

      const response = await fetch('http://192.168.1.6:8000/api/products/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          brand: brand || 'Unknown',
          model: model || '',
          sizes: [{ size: sanitizeString(newItem.size) || 'N/A', stock: parseInt(newItem.stock) || 0 }],
          color: sanitizeString(newItem.color) || null,
          selling_price: parseFloat(newItem.selling_price) || 0,
          discount_price: newItem.discount_price ? parseFloat(newItem.discount_price) : null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gagal menambah produk: ${response.status} ${errorText}`);
      }

      setNewItem({ name: '', stock: '', size: '', color: '', selling_price: '', discount_price: '' });
      setCurrentPage(1);
      setProducts([]);
      setErrorMessage('');
      fetchProducts(searchTerm, sizeTerm, 1);
      Alert.alert('Sukses', 'Produk berhasil ditambahkan');
    } catch (error) {
      console.error('Error adding product:', error.message);
      Alert.alert('Error', error.message || 'Gagal menambah produk');
    }
  };

  // Handle updating product
  const handleUpdateItem = async () => {
    try {
      if (!editItem.name || !editItem.stock || !editItem.selling_price) {
        Alert.alert('Error', 'Nama, stok, dan harga jual wajib diisi');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Silakan login terlebih dahulu');
        return;
      }

      const [brand, ...modelParts] = sanitizeString(editItem.name).split(' ');
      const model = modelParts.join(' ') || '';

      const response = await fetch(`http://192.168.1.6:8000/api/products/${editItem.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          brand: brand || 'Unknown',
          model: model || '',
          sizes: [{ size: sanitizeString(editItem.size) || 'N/A', stock: parseInt(editItem.stock) || 0 }],
          color: sanitizeString(editItem.color) || null,
          selling_price: parseFloat(editItem.selling_price) || 0,
          discount_price: editItem.discount_price ? parseFloat(editItem.discount_price) : null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gagal memperbarui produk: ${response.status} ${errorText}`);
      }

      setEditItem(null);
      setCurrentPage(1);
      setProducts([]);
      setErrorMessage('');
      fetchProducts(searchTerm, sizeTerm, 1);
      Alert.alert('Sukses', 'Produk berhasil diperbarui');
    } catch (error) {
      console.error('Error updating product:', error.message);
      Alert.alert('Error', error.message || 'Gagal memperbarui produk');
    }
  };

  // Handle deleting product
  const handleDeleteItem = async (id) => {
    Alert.alert(
      'Konfirmasi',
      'Apakah Anda yakin ingin menghapus produk ini?',
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
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gagal menghapus produk: ${response.status} ${errorText}`);
              }

              setCurrentPage(1);
              setProducts([]);
              setErrorMessage('');
              fetchProducts(searchTerm, sizeTerm, 1);
              Alert.alert('Sukses', 'Produk berhasil dihapus');
            } catch (error) {
              console.error('Error deleting product:', error.message);
              Alert.alert('Error', error.message || 'Gagal menghapus produk');
            }
          },
        },
      ]
    );
  };

  // Load more products
  const loadMoreProducts = () => {
    if (currentPage < lastPage && !isFetchingMore) {
      fetchProducts(searchTerm, sizeTerm, currentPage + 1, true);
    }
  };

  // Mock data untuk testing
  const useMockData = () => {
    const mockProducts = [
      { id: 1, name: 'Nike Air Max', brand: 'Nike', model: 'Air Max', size: '42', color: 'Black', stock: 10, selling_price: 1500000, discount_price: 1200000 },
      { id: 2, name: 'Adidas Ultraboost', brand: 'Adidas', model: 'Ultraboost', size: '41', color: 'White', stock: 5, selling_price: 2000000, discount_price: null },
    ];
    setProducts(mockProducts);
    updateBrandCounts(mockProducts);
    setErrorMessage('');
    Alert.alert('Info', 'Menggunakan data mock untuk testing');
  };

  // Render product item
  const renderItem = useCallback(({ item, index }) => {
    if (!item || !item.name || !item.id) {
      console.warn('Invalid product item:', item);
      return null;
    }
    const brand = sanitizeString(item.brand) || 'Unknown';
    const model = sanitizeString(item.model) || '-';
    const rowNumber = index + 1;
    const stock = item.stock || 0;
    const physicalStock = stock;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${encodeURIComponent(`http://192.168.1.6:8000/inventory/${item.id}`)}`;

    return (
      <View>
        {index === 0 || (products[index - 1] && products[index - 1].brand !== brand) ? (
          <Text style={styles.brandHeader}>{brand.toUpperCase()}</Text>
        ) : null}
        <View style={[styles.item, index % 2 === 0 ? styles.itemEven : styles.itemOdd]}>
          <Text style={styles.itemText}>{rowNumber}</Text>
          <View style={styles.itemTextContainer}>
            <Text style={styles.itemText}>{brand.toUpperCase()}</Text>
          </View>
          <Text style={styles.itemText}>{model.toUpperCase()}</Text>
          <Text style={styles.itemText}>{sanitizeString(item.size) || '-'}</Text>
          <Text style={styles.itemText}>{sanitizeString(item.color)?.toUpperCase() || '-'}</Text>
          <Text style={[styles.itemText, stock < 5 ? styles.lowStock : null]}>{stock}</Text>
          <Text style={styles.itemText}>{physicalStock}</Text>
          <Text style={styles.itemText}>Rp {new Intl.NumberFormat('id-ID').format(parseFloat(item.selling_price) || 0)}</Text>
          <Text style={styles.itemText}>
            {item.discount_price ? `Rp ${new Intl.NumberFormat('id-ID').format(parseFloat(item.discount_price))}` : '-'}
          </Text>
          <Image
            source={{ uri: qrCodeUrl }}
            style={styles.qrCode}
            onError={(e) => console.log(`Failed to load QR code for product ${item.id}:`, e.nativeEvent.error)}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() =>
                setEditItem({
                  ...item,
                  stock: item.stock?.toString() || '0',
                  selling_price: item.selling_price?.toString() || '0',
                  discount_price: item.discount_price?.toString() || '',
                })
              }
            >
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteItem(item.id)}>
              <Text style={[styles.actionText, { color: '#d9534f' }]}>Hapus</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [products]);

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>MANAGEMENT INVENTORY</Text>

      {/* Inventory Information Cards */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>INVENTORY INFORMATION</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Total Produk</Text>
            <Text style={styles.infoCardValue}>{products.length}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Stok Menipis</Text>
            <Text style={styles.infoCardValue}>{products.filter(p => p && p.stock < 5).length}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Total Unit</Text>
            <Text style={styles.infoCardValue}>{products.reduce((sum, p) => sum + (p && p.stock || 0), 0)}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Jumlah Unit per Brand</Text>
            <Text style={styles.infoCardValue}>
              {Object.entries(brandCounts).length > 0
                ? Object.entries(brandCounts)
                    .map(([brand, count]) => `${sanitizeString(brand).toUpperCase()} (${count} unit)`)
                    .join(', ')
                : 'Tidak ada brand'}
            </Text>
          </View>
        </View>
      </View>

      {/* Search and Buttons */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari brand atau model..."
          value={searchTerm}
          onChangeText={(text) => {
            setSearchTerm(text);
            debouncedSearch(text, sizeTerm);
          }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari ukuran..."
          value={sizeTerm}
          onChangeText={(text) => {
            setSizeTerm(text);
            debouncedSearch(searchTerm, text);
          }}
        />
        <Button title="Cari" onPress={handleSearch} color="#f28c38" />
        <Button title="Gunakan Mock Data" onPress={useMockData} color="#28a745" />
      </View>

      {/* Add/Edit Form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nama Produk (Brand Model)"
          value={editItem ? editItem.name : newItem.name}
          onChangeText={text => (editItem ? setEditItem({ ...editItem, name: text }) : setNewItem({ ...newItem, name: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Stok"
          keyboardType="numeric"
          value={editItem ? editItem.stock : newItem.stock}
          onChangeText={text => (editItem ? setEditItem({ ...editItem, stock: text }) : setNewItem({ ...newItem, stock: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Ukuran"
          value={editItem ? editItem.size : newItem.size}
          onChangeText={text => (editItem ? setEditItem({ ...editItem, size: text }) : setNewItem({ ...newItem, size: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Warna"
          value={editItem ? editItem.color : newItem.color}
          onChangeText={text => (editItem ? setEditItem({ ...editItem, color: text }) : setNewItem({ ...newItem, color: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Harga Jual"
          keyboardType="numeric"
          value={editItem ? editItem.selling_price : newItem.selling_price}
          onChangeText={text => (editItem ? setEditItem({ ...editItem, selling_price: text }) : setNewItem({ ...newItem, selling_price: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Harga Diskon"
          keyboardType="numeric"
          value={editItem ? editItem.discount_price : newItem.discount_price}
          onChangeText={text => (editItem ? setEditItem({ ...editItem, discount_price: text }) : setNewItem({ ...newItem, discount_price: text }))}
        />
        <Button
          title={editItem ? 'Simpan Perubahan' : 'Tambah Produk'}
          onPress={editItem ? handleUpdateItem : handleAddItem}
          color="#f28c38"
        />
        {editItem && <Button title="Batal" color="gray" onPress={() => setEditItem(null)} />}
      </View>

      {/* Product List */}
      <View style={styles.tableContainer}>
        {isLoading && <ActivityIndicator size="large" color="#f28c38" />}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {products.length === 0 && !isLoading && !errorMessage ? (
          <Text style={styles.errorText}>Tidak ada produk ditemukan</Text>
        ) : null}
        <View style={styles.tableHeader}>
          <Text style={styles.headerText}>No</Text>
          <Text style={styles.headerText}>Brand</Text>
          <Text style={styles.headerText}>Model</Text>
          <Text style={styles.headerText}>Ukuran</Text>
          <Text style={styles.headerText}>Warna</Text>
          <Text style={styles.headerText}>Stok</Text>
          <Text style={styles.headerText}>Fisik</Text>
          <Text style={styles.headerText}>Harga</Text>
          <Text style={styles.headerText}>Diskon</Text>
          <Text style={styles.headerText}>QR</Text>
          <Text style={styles.headerText}>Aksi</Text>
        </View>
        <FlatList
          data={products}
          keyExtractor={item => item.id?.toString() || Math.random().toString()}
          renderItem={renderItem}
          scrollEnabled={false}
          onEndReached={loadMoreProducts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingMore ? <ActivityIndicator size="small" color="#f28c38" /> : null}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    backgroundColor: '#f28c38',
    color: '#000',
    padding: 10,
    borderRadius: 5,
    textAlign: 'center',
    marginBottom: 10,
  },
  infoContainer: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoCard: {
    backgroundColor: '#e5e7eb',
    padding: 10,
    borderRadius: 5,
    width: '48%',
    marginBottom: 10,
  },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoCardValue: {
    fontSize: 14,
    color: '#4b5563',
  },
  searchContainer: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 5,
    minWidth: 120,
  },
  form: {
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginBottom: 5,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  tableContainer: {
    backgroundColor: '#333',
    borderRadius: 5,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f28c38',
    padding: 8,
  },
  headerText: {
    flex: 1,
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 10,
  },
  item: {
    flexDirection: 'row',
    padding: 8,
    alignItems: 'center',
  },
  itemEven: {
    backgroundColor: '#fff',
  },
  itemOdd: {
    backgroundColor: '#e5e7eb',
  },
  itemText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: '#000',
  },
  itemTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  lowStock: {
    color: '#dc2626',
  },
  qrCode: {
    width: 40,
    height: 40,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: {
    color: '#2563eb',
    fontSize: 10,
  },
  brandHeader: {
    backgroundColor: '#f28c38',
    color: '#000',
    fontWeight: '600',
    padding: 8,
    textTransform: 'uppercase',
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    marginVertical: 10,
    fontSize: 14,
  },
});