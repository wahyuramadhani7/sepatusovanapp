import React, { useState, useCallback, useMemo } from 'react';
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
import { debounce } from 'lodash';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

// Komponen untuk item produk dengan memoization
const ProductItem = React.memo(({ item, index, onEdit, onDelete, showBrandHeader }) => {
  if (!item || !item.name || !item.id) {
    console.warn('Item produk tidak valid:', item);
    return null;
  }
  const brand = item.brand ? item.brand.replace(/['"]/g, '').replace(/\n/g, '') : 'Unknown';
  const model = item.model ? item.model.replace(/['"]/g, '').replace(/\n/g, '') : '-';
  const rowNumber = index + 1;
  const stock = item.stock || 0;
  const physicalStock = stock;
  const unit = item.units && item.units.length > 0 ? item.units[0] : { unit_code: '-', qr_code: null };

  // Fungsi untuk memvalidasi URL
  const isValidUrl = (url) => {
    try {
      new URL(url);
      return url.match(/\.(png|jpg|jpeg)$/i) !== null;
    } catch {
      return false;
    }
  };

  // Gunakan unit.qr_code jika valid, fallback ke API QR code
  const qrCodeUrl = unit.qr_code && isValidUrl(unit.qr_code)
    ? `${unit.qr_code}?t=${Date.now()}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${encodeURIComponent(
        `http://192.168.1.6:8000/inventory/${item.id}`
      )}&t=${Date.now()}`;
  const unitCode = unit.unit_code || '-';

  return (
    <View>
      {showBrandHeader && (
        <Text style={styles.brandHeader}>{brand.toUpperCase()}</Text>
      )}
      <View style={[styles.item, index % 2 === 0 ? styles.itemEven : styles.itemOdd]}>
        <Text style={[styles.itemText, styles.itemNo]}>{rowNumber}</Text>
        <View style={[styles.itemTextContainer, styles.itemBrand]}>
          <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">{brand.toUpperCase()}</Text>
        </View>
        <View style={[styles.itemTextContainer, styles.itemModel]}>
          <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">{model.toUpperCase()}</Text>
        </View>
        <Text style={[styles.itemText, styles.itemSize]} numberOfLines={1} ellipsizeMode="tail">{item.size ? item.size.replace(/['"]/g, '').replace(/\n/g, '') : '-'}</Text>
        <Text style={[styles.itemText, styles.itemColor]} numberOfLines={1} ellipsizeMode="tail">{item.color ? item.color.replace(/['"]/g, '').replace(/\n/g, '').toUpperCase() : '-'}</Text>
        <Text style={[styles.itemText, styles.itemStock, stock < 5 ? styles.lowStock : null]}>{stock}</Text>
        <Text style={[styles.itemText, styles.itemPhysical]}>{physicalStock}</Text>
        <Text style={[styles.itemText, styles.itemPrice]} numberOfLines={1} ellipsizeMode="tail">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(item.selling_price) || 0)}</Text>
        <Text style={[styles.itemText, styles.itemDiscount]} numberOfLines={1} ellipsizeMode="tail">
          {item.discount_price ? `Rp ${new Intl.NumberFormat('id-ID').format(parseFloat(item.discount_price))}` : '-'}
        </Text>
        <Text style={[styles.itemText, styles.itemUnitCode]} numberOfLines={1} ellipsizeMode="tail">{unitCode}</Text>
        <Image
          source={{ uri: qrCodeUrl }}
          style={styles.qrCode}
          onError={(e) => {
            console.error(`Gagal memuat QR code untuk produk ${item.id}: ${e.nativeEvent.error}`);
          }}
        />
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => onEdit(item)}>
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item.id)}>
            <Text style={[styles.actionText, { color: '#d9534f' }]}>Hapus</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function InventoryScreen() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeTerm, setSizeTerm] = useState('');
  const [newItem, setNewItem] = useState({ name: '', stock: '', size: '', color: '', selling_price: '', discount_price: '' });
  const [editItem, setEditItem] = useState(null);
  const [brandCounts, setBrandCounts] = useState({});
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Sanitize string
  const sanitizeString = useCallback((str) => {
    return (str || '').replace(/['"]/g, '').replace(/\n/g, '');
  }, []);

  // Hitung jumlah brand
  const updateBrandCounts = useCallback((productList) => {
    const counts = {};
    productList.forEach(product => {
      const brand = sanitizeString(product.brand) || 'Unknown';
      counts[brand] = (counts[brand] || 0) + (product.stock || 0);
    });
    setBrandCounts(counts);
  }, [sanitizeString]);

  // Filter produk dengan useMemo
  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (searchTerm.length >= 2) {
      const searchLower = sanitizeString(searchTerm).toLowerCase();
      filtered = filtered.filter(
        product =>
          (product.brand && sanitizeString(product.brand).toLowerCase().includes(searchLower)) ||
          (product.model && sanitizeString(product.model).toLowerCase().includes(searchLower))
      );
    }
    if (sizeTerm.length >= 1) {
      const sizeLower = sanitizeString(sizeTerm).toLowerCase();
      filtered = filtered.filter(
        product => product.size && sanitizeString(product.size).toLowerCase().includes(sizeLower)
      );
    }
    updateBrandCounts(filtered);
    return filtered;
  }, [products, searchTerm, sizeTerm, sanitizeString, updateBrandCounts]);

  // Hitung produk untuk halaman saat ini
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage]);

  // Hitung total halaman
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Debounce pencarian
  const debouncedSearch = useCallback(
    debounce((search, size) => {
      if (search.length < 2 && size.length < 1) {
        Alert.alert('Error', 'Kata kunci brand atau model minimal 2 karakter atau masukkan ukuran.');
        return;
      }
      setErrorMessage('');
      fetchAllProducts(sanitizeString(search), sanitizeString(size));
    }, 500),
    [sanitizeString]
  );

  // Handle pencarian
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    if (products.length > 0) {
      // Filter sudah dilakukan oleh useMemo
    } else {
      debouncedSearch(searchTerm, sizeTerm);
    }
  }, [products, searchTerm, sizeTerm, debouncedSearch]);

  // Bersihkan cache AsyncStorage
  const clearCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('cache_valid');
      const cacheKey = 'all_products';
      const count = await AsyncStorage.getItem(`${cacheKey}_count`);
      if (count) {
        const total = parseInt(count, 10);
        for (let i = 0; i < total; i += 500) {
          await AsyncStorage.removeItem(`${cacheKey}_${i}`);
        }
        await AsyncStorage.removeItem(`${cacheKey}_count`);
      }
      console.log('Cache AsyncStorage berhasil dibersihkan');
    } catch (error) {
      console.error('Gagal membersihkan cache:', error.message);
    }
  }, []);

  // Ambil semua produk dari API
  const fetchAllProducts = useCallback(async (search = '', size = '') => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setErrorMessage('Silakan login terlebih dahulu');
        Alert.alert('Error', 'Silakan login terlebih dahulu');
        setIsLoading(false);
        return;
      }

      let allProducts = [];
      let currentApiPage = 1;
      let lastPage = 1;
      const perPage = 100;
      const maxRetries = 3;

      do {
        let retries = 0;
        let success = false;
        while (retries < maxRetries && !success) {
          try {
            const url = new URL('http://192.168.1.6:8000/api/products/');
            if (search) url.searchParams.set('search', search);
            if (size) url.searchParams.set('size', size);
            url.searchParams.set('page', currentApiPage);
            url.searchParams.set('per_page', perPage);
            url.searchParams.set('no_cache', 'true');
            url.searchParams.set('order_by', 'created_at');
            url.searchParams.set('sort', 'desc');

            const response = await fetch(url, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Cache-Control': 'no-cache',
              },
              timeout: 10000,
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Gagal mengambil data (halaman ${currentApiPage}): ${response.status} ${errorText}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error(`Respons API bukan JSON di halaman ${currentApiPage}`);
            }

            const data = await response.json();
            let productData = data.data?.products || [];
            if (!Array.isArray(productData)) {
              throw new Error('Data produk dari API tidak valid');
            }

            const validProducts = productData.filter(
              product => product && product.id && product.name && typeof product.stock === 'number' && Array.isArray(product.units)
            );

            allProducts = [...allProducts, ...validProducts];
            lastPage = data.data?.pagination?.last_page || 1;
            success = true;
          } catch (error) {
            retries++;
            if (retries >= maxRetries) {
              throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        currentApiPage++;
      } while (currentApiPage <= lastPage);

      if (allProducts.length === 0) {
        setErrorMessage('Tidak ada produk valid ditemukan');
      } else {
        setProducts(allProducts);
        await clearCache();
      }
    } catch (error) {
      setErrorMessage(error.message || 'Gagal mengambil data produk');
      Alert.alert('Error', error.message || 'Gagal mengambil data produk');
    } finally {
      setIsLoading(false);
    }
  }, [clearCache]);

  // Tambah produk baru
  const handleAddItem = useCallback(async () => {
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
          'Cache-Control': 'no-cache',
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

      const newProduct = await response.json();
      setProducts(prev => [...prev, ...(Array.isArray(newProduct.data.products) ? newProduct.data.products : [newProduct.data])]);
      setNewItem({ name: '', stock: '', size: '', color: '', selling_price: '', discount_price: '' });
      setCurrentPage(1);
      setErrorMessage('');
      Alert.alert('Sukses', 'Produk berhasil ditambahkan');
      await clearCache();
      await fetchAllProducts();
    } catch (error) {
      Alert.alert('Error', error.message || 'Gagal menambah produk');
    }
  }, [newItem, sanitizeString, clearCache, fetchAllProducts]);

  // Perbarui produk
  const handleUpdateItem = useCallback(async () => {
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
          'Cache-Control': 'no-cache',
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

      const updatedProduct = await response.json();
      setProducts(prev => prev.map(p => (p.id === editItem.id ? { ...p, ...updatedProduct.data, units: updatedProduct.data.units || [] } : p)));
      setEditItem(null);
      setCurrentPage(1);
      setErrorMessage('');
      Alert.alert('Sukses', 'Produk berhasil diperbarui');
      await clearCache();
      await fetchAllProducts();
    } catch (error) {
      Alert.alert('Error', error.message || 'Gagal memperbarui produk');
    }
  }, [editItem, sanitizeString, clearCache, fetchAllProducts]);

  // Hapus produk
  const handleDeleteItem = useCallback((id) => {
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
                  'Cache-Control': 'no-cache',
                },
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gagal menghapus produk: ${response.status} ${errorText}`);
              }

              setProducts(prev => prev.filter(p => p.id !== id));
              setCurrentPage(1);
              setErrorMessage('');
              Alert.alert('Sukses', 'Produk berhasil dihapus');
              await clearCache();
              await fetchAllProducts();
            } catch (error) {
              Alert.alert('Error', error.message || 'Gagal menghapus produk');
            }
          },
        },
      ]
    );
  }, [clearCache, fetchAllProducts]);

  // Cek cache dan sinkronisasi saat layar fokus
  useFocusEffect(
    useCallback(() => {
      const checkAndSync = async () => {
        await clearCache();
        await fetchAllProducts();
      };
      checkAndSync();
    }, [clearCache, fetchAllProducts])
  );

  // Render item produk
  const renderItem = useCallback(
    ({ item, index }) => {
      const showBrandHeader = index === 0 || (paginatedProducts[index - 1] && paginatedProducts[index - 1].brand !== item.brand);
      return (
        <View style={styles.tableRowContainer}>
          <ProductItem
            item={item}
            index={(currentPage - 1) * itemsPerPage + index}
            onEdit={(item) =>
              setEditItem({
                ...item,
                stock: item.stock?.toString() || '0',
                selling_price: item.selling_price?.toString() || '0',
                discount_price: item.discount_price?.toString() || '',
              })
            }
            onDelete={handleDeleteItem}
            showBrandHeader={showBrandHeader}
          />
        </View>
      );
    },
    [currentPage, handleDeleteItem, paginatedProducts]
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>MANAJEMEN INVENTARIS</Text>

      {/* Kartu Informasi Inventaris */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>INFORMASI INVENTARIS</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Total Produk</Text>
            <Text style={styles.infoCardValue}>{filteredProducts.length}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Stok Menipis</Text>
            <Text style={styles.infoCardValue}>{filteredProducts.filter(p => p && p.stock < 5).length}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Total Unit</Text>
            <Text style={styles.infoCardValue}>{filteredProducts.reduce((sum, p) => sum + (p && p.stock || 0), 0)}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Jumlah Unit per Brand</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedBrand}
                onValueChange={(value) => setSelectedBrand(value)}
                style={styles.picker}
              >
                <Picker.Item label={`Semua (${Object.keys(brandCounts).length} brand)`} value="all" />
                {Object.entries(brandCounts).map(([brand, count]) => (
                  <Picker.Item
                    key={brand}
                    label={`${sanitizeString(brand).toUpperCase()} (${count} unit)`}
                    value={brand}
                  />
                ))}
              </Picker>
              {selectedBrand !== 'all' && (
                <Text style={styles.infoCardValue}>
                  {sanitizeString(selectedBrand).toUpperCase()}: {brandCounts[selectedBrand]} unit
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Pencarian dan Tombol */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari brand atau model..."
          value={searchTerm}
          onChangeText={(text) => {
            setSearchTerm(text);
            setCurrentPage(1);
          }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari ukuran..."
          value={sizeTerm}
          onChangeText={(text) => {
            setSizeTerm(text);
            setCurrentPage(1);
          }}
        />
        <Button title="Cari" onPress={handleSearch} color="#f28c38" />
        <Button
          title="Refresh Produk"
          onPress={async () => {
            setIsLoading(true);
            await clearCache();
            await fetchAllProducts();
            setIsLoading(false);
          }}
          color="#f28c38"
        />
      </View>

      {/* Form Tambah/Edit */}
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

      {/* Daftar Produk dan Pagination */}
      <View style={styles.tableContainer}>
        {isLoading && <ActivityIndicator size="large" color="#f28c38" />}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {filteredProducts.length === 0 && !isLoading && !errorMessage ? (
          <Text style={styles.errorText}>Tidak ada produk ditemukan</Text>
        ) : null}
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
          <View style={styles.tableContent}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerText, styles.headerNo]}>No</Text>
              <Text style={[styles.headerText, styles.headerBrand]}>Brand</Text>
              <Text style={[styles.headerText, styles.headerModel]}>Model</Text>
              <Text style={[styles.headerText, styles.headerSize]}>Ukuran</Text>
              <Text style={[styles.headerText, styles.headerColor]}>Warna</Text>
              <Text style={[styles.headerText, styles.headerStock]}>Stok</Text>
              <Text style={[styles.headerText, styles.headerPhysical]}>Fisik</Text>
              <Text style={[styles.headerText, styles.headerPrice]}>Harga</Text>
              <Text style={[styles.headerText, styles.headerDiscount]}>Diskon</Text>
              <Text style={[styles.headerText, styles.headerUnitCode]}>Kode Unit</Text>
              <Text style={[styles.headerText, styles.headerQR]}>QR</Text>
              <Text style={[styles.headerText, styles.headerActions]}>Aksi</Text>
            </View>
            <FlatList
              data={paginatedProducts}
              keyExtractor={item => item.id?.toString()}
              renderItem={renderItem}
              scrollEnabled={false}
              initialNumToRender={itemsPerPage}
              maxToRenderPerBatch={itemsPerPage}
              windowSize={2}
              removeClippedSubviews={true}
              extraData={products}
              getItemLayout={(data, index) => ({
                length: 60,
                offset: 60 * index,
                index,
              })}
            />
          </View>
        </ScrollView>
        {totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <Button
              title="Sebelumnya"
              disabled={currentPage === 1}
              onPress={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              color="#f28c38"
            />
            <Text style={styles.paginationText}>
              Halaman {currentPage} dari {totalPages}
            </Text>
            <Button
              title="Selanjutnya"
              disabled={currentPage === totalPages}
              onPress={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              color="#f28c38"
            />
          </View>
        )}
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
  pickerContainer: {
    marginTop: 5,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 5,
    height: 40,
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
  tableScroll: {
    flexGrow: 0,
  },
  tableContent: {
    minWidth: 800, // Ensure table is wide enough for all columns
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f28c38',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tableRowContainer: {
    minWidth: 800, // Match tableContent width
  },
  headerText: {
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: 5,
  },
  headerNo: {
    width: 50,
  },
  headerBrand: {
    width: 120,
  },
  headerModel: {
    width: 120,
  },
  headerSize: {
    width: 80,
  },
  headerColor: {
    width: 80,
  },
  headerStock: {
    width: 60,
  },
  headerPhysical: {
    width: 60,
  },
  headerPrice: {
    width: 100,
  },
  headerDiscount: {
    width: 100,
  },
  headerUnitCode: {
    width: 80,
  },
  headerQR: {
    width: 60,
  },
  headerActions: {
    width: 100,
  },
  item: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    minHeight: 60,
  },
  itemEven: {
    backgroundColor: '#fff',
  },
  itemOdd: {
    backgroundColor: '#e5e7eb',
  },
  itemText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#000',
    paddingVertical: 5,
  },
  itemTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNo: {
    width: 50,
  },
  itemBrand: {
    width: 120,
  },
  itemModel: {
    width: 120,
  },
  itemSize: {
    width: 80,
  },
  itemColor: {
    width: 80,
  },
  itemStock: {
    width: 60,
  },
  itemPhysical: {
    width: 60,
  },
  itemPrice: {
    width: 100,
  },
  itemDiscount: {
    width: 100,
  },
  itemUnitCode: {
    width: 80,
  },
  lowStock: {
    color: '#dc2626',
  },
  qrCode: {
    width: 40,
    height: 40,
    marginHorizontal: 5,
  },
  actions: {
    width: 100,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: '#2563eb',
    fontSize: 11,
    textAlign: 'center',
  },
  brandHeader: {
    backgroundColor: '#f28c38',
    color: '#000',
    fontWeight: '600',
    padding: 8,
    textTransform: 'uppercase',
    fontSize: 12,
    minWidth: 800, // Match tableContent width
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    marginVertical: 10,
    fontSize: 14,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  paginationText: {
    fontSize: 14,
    color: '#fff',
  },
});