import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  SafeAreaView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { Camera } from 'expo-camera';
import jsQR from 'jsqr';

const CreateTransactionScreen = ({ navigation }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUnits, setAvailableUnits] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cardType, setCardType] = useState('');
  const [notes, setNotes] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState('success');
  const [scannedUnitCodes, setScannedUnitCodes] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('darkMode').then((value) => {
      if (value) setDarkMode(JSON.parse(value));
    });
    fetchUnits();
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setErrorMessage('Token tidak ditemukan. Silakan login kembali.');
        throw new Error('Token autentikasi tidak ditemukan.');
      }

      let allProducts = [];
      let currentPage = 1;
      let lastPage = 1;
      const perPage = 100;

      do {
        const url = new URL('http://192.168.1.6:8000/api/products/');
        url.searchParams.set('page', currentPage);
        url.searchParams.set('per_page', perPage);
        url.searchParams.set('no_cache', 'true');
        url.searchParams.set('order_by', 'created_at');
        url.searchParams.set('sort', 'desc');

        console.log(`Mengambil halaman ${currentPage}: ${url.toString()}`);

        const response = await axios.get(url.toString(), {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
        });

        console.log('API Response:', JSON.stringify(response.data, null, 2));

        const productData = response.data.data?.products || [];
        if (!Array.isArray(productData)) {
          throw new Error('Data produk dari API tidak valid');
        }

        const validProducts = productData.filter(
          (product) =>
            product &&
            product.id &&
            product.name &&
            typeof product.stock === 'number' &&
            Array.isArray(product.units)
        );

        allProducts = [...allProducts, ...validProducts];
        lastPage = response.data.data?.pagination?.last_page || 1;
        currentPage++;
      } while (currentPage <= lastPage);

      if (allProducts.length === 0) {
        setErrorMessage('Tidak ada produk tersedia dari API.');
      } else {
        const mappedProducts = allProducts.flatMap((product) => {
          const units = product.units || [];
          return units.length > 0
            ? units.map((unit) => ({
                product_id: product.id,
                product_name: product.name,
                color: product.color || '-',
                size: product.size || '-',
                selling_price: parseFloat(product.selling_price) || 0,
                discount_price: product.discount_price
                  ? parseFloat(product.discount_price)
                  : null,
                unit_code: unit.unit_code || `UNIT-${product.id}`,
                stock: product.stock || 0,
              }))
            : [{
                product_id: product.id,
                product_name: product.name,
                color: product.color || '-',
                size: product.size || '-',
                selling_price: parseFloat(product.selling_price) || 0,
                discount_price: product.discount_price
                  ? parseFloat(product.discount_price)
                  : null,
                unit_code: `UNIT-${product.id}`,
                stock: product.stock || 0,
              }];
        });
        setAvailableUnits(mappedProducts);
        setSearchResults([]);
        console.log('Mapped Products:', JSON.stringify(mappedProducts, null, 2));
      }
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || 'Gagal mengambil data produk.';
      setErrorMessage(message);
      console.error('Fetch products error:', error);
      if (error.response?.status === 401) {
        await AsyncStorage.removeItem('token');
        navigation.navigate('Login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  const searchUnits = () => {
    if (searchQuery.trim()) {
      const results = availableUnits
        .filter(
          (u) =>
            u.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.color?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.size?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.unit_code?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 20);
      setSearchResults(results);
      console.log('Search Results:', JSON.stringify(results, null, 2));
    } else {
      setSearchResults([]);
    }
  };

  const addToCart = (unit) => {
    console.log('Attempting to add unit to cart:', JSON.stringify(unit, null, 2));
    if (unit.stock <= 0) {
      console.log('Stock is zero for unit:', unit.unit_code);
      showPopupMessage(
        'Stok Habis',
        `Unit "${unit.unit_code}" tidak memiliki stok.`,
        'error'
      );
      return;
    }
    if (scannedUnitCodes.includes(unit.unit_code)) {
      console.log('Unit already in cart:', unit.unit_code);
      showPopupMessage(
        'Unit Sudah Ditambahkan',
        `Unit dengan kode "${unit.unit_code}" sudah ada di keranjang.`,
        'error'
      );
      return;
    }
    setCart((prev) => {
      const newCart = [
        ...prev,
        {
          product_id: unit.product_id,
          name: unit.product_name,
          color: unit.color,
          size: unit.size,
          selling_price: unit.selling_price,
          discount_price: unit.discount_price,
          unit_code: unit.unit_code,
          quantity: 1,
        },
      ];
      console.log('Updated Cart:', JSON.stringify(newCart, null, 2));
      return newCart;
    });
    setScannedUnitCodes((prev) => {
      const newCodes = [...prev, unit.unit_code];
      console.log('Updated Scanned Unit Codes:', newCodes);
      return newCodes;
    });
    setSearchQuery('');
    setSearchResults([]);
    showPopupMessage(
      'Unit Ditambahkan',
      `Unit "${unit.unit_code}" berhasil ditambahkan ke keranjang!`,
      'success'
    );
    setShowProductDropdown(false);
    setScanning(false);
  };

  const handleFrameProcessor = async () => {
    if (!scanning || !cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          console.log(`Scanned QR code: ${code.data}`);
          const scannedUnit = availableUnits.find((unit) => unit.unit_code === code.data);
          if (scannedUnit) {
            addToCart(scannedUnit);
          } else {
            showPopupMessage(
              'Unit Tidak Ditemukan',
              `Kode unit "${code.data}" tidak ditemukan.`,
              'error'
            );
            setScanning(false);
          }
        }
      };
    } catch (error) {
      console.error('Frame processing error:', error);
    }
  };

  const removeItem = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    setScannedUnitCodes((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return cart.reduce((total, item) => {
      const price =
        item.discount_price !== null && item.discount_price !== undefined
          ? item.discount_price
          : item.selling_price;
      return total + (price || 0) * (item.quantity || 1);
    }, 0);
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    const total = parseFloat(newTotal) || 0;
    return Math.max(0, subtotal - total);
  };

  const calculateTotal = () => {
    return Math.max(0, parseFloat(newTotal) || calculateSubtotal());
  };

  const showPopupMessage = (title, message, type) => {
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const validateForm = () => {
    if (cart.length === 0) {
      showPopupMessage(
        'Keranjang Kosong',
        'Tambahkan unit produk terlebih dahulu.',
        'error'
      );
      return false;
    }
    if (!paymentMethod) {
      showPopupMessage(
        'Metode Pembayaran Kosong',
        'Silakan pilih metode pembayaran!',
        'error'
      );
      return false;
    }
    if (paymentMethod === 'debit' && !cardType) {
      showPopupMessage(
        'Tipe Kartu Kosong',
        'Silakan pilih tipe kartu untuk metode pembayaran Debit!',
        'error'
      );
      return false;
    }
    const total = parseFloat(newTotal);
    if (newTotal === '' || isNaN(total) || total < 0) {
      showPopupMessage(
        'Harga Baru Tidak Valid',
        'Harga baru harus diisi dan tidak boleh kurang dari 0.',
        'error'
      );
      return false;
    }
    if (total > calculateSubtotal()) {
      showPopupMessage(
        'Harga Baru Tidak Valid',
        'Harga baru tidak boleh melebihi subtotal.',
        'error'
      );
      return false;
    }
    return true;
  };

  const submitTransaction = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setErrorMessage('Token tidak ditemukan. Silakan login kembali.');
        throw new Error('Token autentikasi tidak ditemukan.');
      }

      const payload = {
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null,
        payment_method: paymentMethod,
        card_type: paymentMethod === 'debit' ? cardType : null,
        notes: notes || null,
        discount_amount: parseFloat(newTotal) || calculateSubtotal(),
        products: cart.map((item) => ({
          product_id: item.product_id,
          unit_code: item.unit_code,
          discount_price: item.discount_price,
          quantity: item.quantity,
        })),
      };

      const response = await axios.post(
        'http://192.168.1.6:8000/api/transactions',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Gagal membuat transaksi.');
      }

      showPopupMessage(
        'Transaksi Berhasil',
        'Transaksi telah berhasil dibuat!',
        'success'
      );
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setPaymentMethod('');
      setCardType('');
      setNotes('');
      setNewTotal('');
      setScannedUnitCodes([]);
      setTimeout(() => {
        setShowPopup(false);
        navigation.navigate('TransactionScreen');
      }, 2000);
    } catch (error) {
      const message =
        error.response?.data?.message || 'Gagal membuat transaksi.';
      showPopupMessage('Gagal Membuat Transaksi', message, 'error');
      console.error('Create transaction error:', error);
      if (error.response?.status === 401) {
        await AsyncStorage.removeItem('token');
        navigation.navigate('Login');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (amount) =>
    `Rp ${new Intl.NumberFormat('id-ID').format(amount || 0)}`;

  const renderUnit = ({ item }) => (
    <TouchableOpacity
      style={[styles.productCard, darkMode && styles.productCardDark]}
      onPress={() => {
        console.log('Product card pressed:', item.unit_code);
        addToCart(item);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.productCardContent}>
        <Text style={[styles.text, darkMode && styles.textDark, styles.productName]}>
          {item.product_name || 'Nama tidak tersedia'}
        </Text>
        <Text style={[styles.text, darkMode && styles.textDark, styles.productDetails]}>
          Warna: {item.color || '-'}, Ukuran: {item.size || '-'}, Kode: {item.unit_code || '-'}
        </Text>
        <Text style={[styles.text, darkMode && styles.textDark, styles.productStock]}>
          Stok: {item.stock || 0}
        </Text>
        <Text style={[styles.text, darkMode && styles.textDark, styles.productPrice]}>
          {item.discount_price
            ? formatRupiah(item.discount_price)
            : formatRupiah(item.selling_price)}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.button, darkMode && styles.buttonDark, styles.addButton]}
        onPress={() => {
          console.log('Add button pressed:', item.unit_code);
          addToCart(item);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>+ Tambah</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderCartItem = ({ item, index }) => (
    <View style={[styles.card, darkMode && styles.cardDark]}>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeItem(index)}
      >
        <Text style={styles.buttonText}>X</Text>
      </TouchableOpacity>
      <Text style={[styles.text, darkMode && styles.textDark]}>{item.name}</Text>
      <Text style={[styles.text, darkMode && styles.textDark]}>
        Warna: {item.color}, Ukuran: {item.size}, Kode: {item.unit_code}
      </Text>
      <Text style={[styles.text, darkMode && styles.textDark]}>
        {item.discount_price
          ? formatRupiah(item.discount_price)
          : formatRupiah(item.selling_price)}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <Text style={[styles.headerText, darkMode && styles.textDark]}>
          Buat Transaksi Baru
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => setDarkMode(!darkMode)}>
            <Text style={styles.text}>{darkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>← Kembali</Text>
          </TouchableOpacity>
        </View>
      </View>

      {errorMessage && (
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <Text style={[styles.text, darkMode && styles.textDark]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={[styles.button, darkMode && styles.buttonDark]}
            onPress={async () => {
              setErrorMessage('');
              await AsyncStorage.removeItem('token');
              navigation.navigate('Login');
            }}
          >
            <Text style={styles.buttonText}>Coba Login Lagi</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.card, darkMode && styles.cardDark, styles.productListContainer]}>
        <Text style={[styles.fieldLabel, darkMode && styles.textDark]}>
          Pilih Unit Produk
        </Text>
        <TouchableOpacity
          style={[styles.dropdownButton, darkMode && styles.dropdownButtonDark]}
          onPress={() => {
            console.log('Dropdown button pressed, current state:', showProductDropdown);
            setShowProductDropdown(!showProductDropdown);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.text, darkMode && styles.textDark]}>
            Cari Produk Manual
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dropdownButton, darkMode && styles.dropdownButtonDark]}
          onPress={() => {
            if (hasCameraPermission === null) {
              showPopupMessage(
                'Menunggu Izin Kamera',
                'Sedang memeriksa izin kamera...',
                'error'
              );
            } else if (hasCameraPermission === false) {
              showPopupMessage(
                'Izin Kamera Ditolak',
                'Aplikasi membutuhkan akses kamera untuk memindai kode unit. Silakan izinkan akses kamera di pengaturan perangkat.',
                'error'
              );
            } else {
              console.log('Opening scanner');
              setScanning(true);
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.text, darkMode && styles.textDark]}>
            Scan Kode Unit
          </Text>
        </TouchableOpacity>
        <Modal
          visible={showProductDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            console.log('Modal close requested');
            setShowProductDropdown(false);
          }}
        >
          <View style={styles.dropdownModal}>
            <View style={[styles.dropdownContainer, darkMode && styles.dropdownContainerDark]}>
              <TextInput
                style={[styles.input, darkMode && styles.inputDark]}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchUnits();
                }}
                placeholder="Cari nama, warna, ukuran, atau kode unit..."
                placeholderTextColor={darkMode ? '#aaa' : '#8892B0'}
              />
              <View style={[styles.scrollContainer, darkMode && styles.scrollContainerDark]}>
                <FlatList
                  data={searchQuery.trim() ? searchResults : availableUnits}
                  renderItem={renderUnit}
                  keyExtractor={(item) => item.unit_code}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.productListContent}
                  ListEmptyComponent={
                    !loading && (
                      <Text style={[styles.text, darkMode && styles.textDark, styles.emptyText]}>
                        {searchQuery.trim()
                          ? 'Tidak ada hasil pencarian.'
                          : 'Tidak ada produk tersedia.'}
                      </Text>
                    )
                  }
                />
              </View>
              {loading && (
                <View style={[styles.card, darkMode && styles.cardDark]}>
                  <ActivityIndicator
                    size="large"
                    color={darkMode ? '#FBBF24' : '#FF6B35'}
                  />
                  <Text style={[styles.text, darkMode && styles.textDark]}>
                    Memuat...
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.button, darkMode && styles.buttonDark]}
                onPress={() => {
                  console.log('Close button pressed');
                  setShowProductDropdown(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>

      <View style={[styles.card, darkMode && styles.cardDark]}>
        <Text style={[styles.fieldLabel, darkMode && styles.textDark]}>
          Informasi Pelanggan
        </Text>
        <TextInput
          style={[styles.input, darkMode && styles.inputDark]}
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Nama Pelanggan"
          placeholderTextColor={darkMode ? '#aaa' : '#8892B0'}
        />
        <TextInput
          style={[styles.input, darkMode && styles.inputDark]}
          value={customerPhone}
          onChangeText={setCustomerPhone}
          placeholder="No. Telepon"
          placeholderTextColor={darkMode ? '#aaa' : '#8892B0'}
          keyboardType="phone-pad"
        />
        <TextInput
          style={[styles.input, darkMode && styles.inputDark]}
          value={customerEmail}
          onChangeText={setCustomerEmail}
          placeholder="Email Pelanggan"
          placeholderTextColor={darkMode ? '#aaa' : '#8892B0'}
          keyboardType="email-address"
        />
        <Picker
          selectedValue={paymentMethod}
          onValueChange={(value) => {
            setPaymentMethod(value);
            if (value !== 'debit') setCardType('');
          }}
          style={[styles.input, darkMode && styles.inputDark]}
        >
          <Picker.Item label="Pilih metode pembayaran" value="" />
          <Picker.Item label="Tunai" value="cash" />
          <Picker.Item label="QRIS" value="qris" />
          <Picker.Item label="Debit" value="debit" />
          <Picker.Item label="Transfer Bank" value="transfer" />
        </Picker>
        {paymentMethod === 'debit' && (
          <Picker
            selectedValue={cardType}
            onValueChange={setCardType}
            style={[styles.input, darkMode && styles.inputDark]}
          >
            <Picker.Item label="Pilih tipe kartu" value="" />
            <Picker.Item label="Mandiri" value="Mandiri" />
            <Picker.Item label="BRI" value="BRI" />
            <Picker.Item label="BCA" value="BCA" />
          </Picker>
        )}
        <TextInput
          style={[styles.input, darkMode && styles.inputDark, { height: 100 }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Catatan"
          placeholderTextColor={darkMode ? '#aaa' : '#8892B0'}
          multiline
        />
      </View>

      <View style={[styles.card, darkMode && styles.cardDark]}>
        <Text style={[styles.fieldLabel, darkMode && styles.textDark]}>
          Keranjang Belanja
        </Text>
        {cart.length === 0 ? (
          <View style={[styles.card, darkMode && styles.cardDark]}>
            <Text style={[styles.text, darkMode && styles.textDark]}>
              Keranjang Kosong
            </Text>
            <Text style={[styles.text, darkMode && styles.textDark]}>
              Tambahkan unit produk dari daftar atau scan kode unit
            </Text>
          </View>
        ) : (
          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={(_, index) => index.toString()}
            style={{ maxHeight: 200 }}
          />
        )}
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.text, darkMode && styles.textDark]}>
            Subtotal: {formatRupiah(calculateSubtotal())}
          </Text>
          <Text style={[styles.text, darkMode && styles.textDark]}>
            Diskon: {formatRupiah(calculateDiscount())}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.text, darkMode && styles.textDark]}>
              Harga Baru:{' '}
            </Text>
            <TextInput
              style={[styles.input, darkMode && styles.inputDark, { flex: 1 }]}
              value={newTotal}
              onChangeText={(text) => {
                setNewTotal(text);
                const total = parseFloat(text);
                if (total > calculateSubtotal()) {
                  showPopupMessage(
                    'Harga Baru Tidak Valid',
                    'Harga baru tidak boleh melebihi subtotal.',
                    'error'
                  );
                  setNewTotal(calculateSubtotal().toString());
                } else if (total < 0) {
                  showPopupMessage(
                    'Harga Baru Tidak Valid',
                    'Harga baru tidak boleh kurang dari 0.',
                    'error'
                  );
                  setNewTotal('');
                }
              }}
              placeholder="Masukkan harga baru"
              placeholderTextColor={darkMode ? '#aaa' : '#8892B0'}
              keyboardType="numeric"
            />
          </View>
          <Text
            style={[
              styles.text,
              darkMode && styles.textDark,
              { fontWeight: 'bold' },
            ]}
          >
            Total Bayar: {formatRupiah(calculateTotal())}
          </Text>
          <TouchableOpacity
            style={[
              styles.button,
              darkMode && styles.buttonDark,
              { opacity: cart.length === 0 || loading ? 0.5 : 1 },
            ]}
            onPress={submitTransaction}
            disabled={cart.length === 0 || loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Memproses...' : 'Proses Transaksi'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
      {scanning ? (
        <View style={{ flex: 1 }}>
          <Camera
            style={{ flex: 1 }}
            ref={cameraRef}
            onCameraReady={() => {
              setInterval(handleFrameProcessor, 1000);
            }}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerInstruction}>
              Arahkan kamera ke kode QR unit
            </Text>
            <View style={styles.scannerFrame} />
          </View>
          <TouchableOpacity
            style={[styles.button, darkMode && styles.buttonDark, styles.cancelButton]}
            onPress={() => {
              console.log('Cancel scan pressed');
              setScanning(false);
            }}
          >
            <Text style={styles.buttonText}>Batal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          keyExtractor={(item, index) => index.toString()}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={<View style={{ height: 20 }} />}
          nestedScrollEnabled={true}
        />
      )}
      <Modal visible={showPopup} transparent animationType="fade">
        <View style={styles.modal}>
          <View style={[styles.card, darkMode && styles.cardDark]}>
            <Text
              style={[styles.text, darkMode && styles.textDark, { fontWeight: 'bold' }]}
            >
              {popupTitle}
            </Text>
            <Text style={[styles.text, darkMode && styles.textDark]}>
              {popupMessage}
            </Text>
            <TouchableOpacity
              style={[styles.button, darkMode && styles.buttonDark]}
              onPress={() => setShowPopup(false)}
            >
              <Text style={styles.buttonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2A3441' },
  containerDark: { backgroundColor: '#1E2A3A' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: { fontSize: 24, fontWeight: 'bold', color: '#FF6B35' },
  card: {
    padding: 16,
    margin: 8,
    backgroundColor: '#1E2A3A',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  cardDark: { backgroundColor: '#2A3441' },
  text: { fontSize: 16, color: '#8892B0' },
  textDark: { color: '#E8E8E8' },
  fieldLabel: {
    fontSize: 16,
    color: '#FF6B35',
    marginBottom: 8,
    marginLeft: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
    color: '#2A3441',
  },
  inputDark: { borderColor: '#666', backgroundColor: '#E8E8E8', color: '#2A3441' },
  button: {
    backgroundColor: '#FF6B35',
    padding: 8,
    borderRadius: 8,
    margin: 4,
    alignItems: 'center',
  },
  buttonDark: { backgroundColor: '#FF6B35' },
  backButton: {
    backgroundColor: '#FF6B35',
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff0000',
    padding: 4,
    borderRadius: 4,
  },
  buttonText: { color: '#FFFFFF', textAlign: 'center', fontWeight: 'bold' },
  modal: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  productListContainer: {
    paddingBottom: 16,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1E2A3A',
    marginVertical: 8,
    alignItems: 'center',
  },
  dropdownButtonDark: {
    borderColor: '#666',
    backgroundColor: '#2A3441',
  },
  dropdownModal: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dropdownContainer: {
    margin: 20,
    padding: 16,
    backgroundColor: '#1E2A3A',
    borderRadius: 12,
    maxHeight: '80%',
    width: '90%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  dropdownContainerDark: {
    backgroundColor: '#2A3441',
  },
  scrollContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#1E2A3A',
    marginVertical: 8,
    maxHeight: '60%',
  },
  scrollContainerDark: {
    borderColor: '#666',
    backgroundColor: '#2A3441',
  },
  productListContent: {
    padding: 8,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#2A3441',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  productCardDark: {
    backgroundColor: '#1E2A3A',
    borderColor: '#666',
  },
  productCardContent: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productDetails: {
    fontSize: 14,
    marginBottom: 4,
  },
  productStock: {
    fontSize: 14,
    marginBottom: 4,
  },
  productPrice: {
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  emptyText: {
    textAlign: 'center',
    padding: 16,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  scannerInstruction: {
    position: 'absolute',
    top: 20,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
});

export default CreateTransactionScreen;