 import React, { useState, useEffect, useCallback } from 'react';
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

   const CreateTransactionScreen = ({ navigation }) => {
     const [darkMode, setDarkMode] = useState(false);
     const [searchQuery, setSearchQuery] = useState('');
     const [availableUnits, setAvailableUnits] = useState([]);
     const [searchResults, setSearchResults] = useState([]);
     const [cart, setCart] = useState([]);
     const [customerName, setCustomerName] = useState('');
     const [customerPhone, setCustomerPhone] = useState('');
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

     useEffect(() => {
       AsyncStorage.getItem('darkMode').then(value => {
         if (value) setDarkMode(JSON.parse(value));
       });
       fetchUnits();
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

         const response = await fetch('http://192.168.1.6:8000/api/units', {
           method: 'GET',
           headers: {
             Accept: 'application/json',
             Authorization: `Bearer ${token}`,
           },
         });

         const data = await response.json();
         if (!response.ok) {
           if (response.status === 401) {
             setErrorMessage('Sesi habis atau token tidak valid. Silakan login kembali.');
             await AsyncStorage.removeItem('token');
             navigation.navigate('Login');
           }
           throw new Error(`HTTP Error: ${response.status}`);
         }

         if (!data.success) {
           throw new Error(data.message || 'Gagal mengambil data unit.');
         }

         setAvailableUnits(data.data || []);
         setSearchResults([]);
       } catch (error) {
         setErrorMessage(error.message);
         console.error('Fetch error:', error.message);
       } finally {
         setLoading(false);
       }
     }, [navigation]);

     const searchUnits = () => {
       if (searchQuery.trim()) {
         const results = availableUnits
           .filter(
             u =>
               u.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               u.color?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               u.size?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               u.unit_code?.toLowerCase().includes(searchQuery.toLowerCase())
           )
           .slice(0, 20);
         setSearchResults(results);
       } else {
         setSearchResults([]);
       }
     };

     const addToCart = unit => {
       if (scannedUnitCodes.includes(unit.unit_code)) {
         showPopupMessage('Unit Sudah Ditambahkan', `Unit dengan kode "${unit.unit_code}" sudah ada di keranjang.`, 'error');
         return;
       }
       setCart(prev => [
         ...prev,
         {
           product_id: unit.product_id,
           name: unit.product_name,
           color: unit.color,
           size: unit.size,
           selling_price: parseFloat(unit.selling_price) || 0,
           discount_price: unit.discount_price ? parseFloat(unit.discount_price) : null,
           unit_code: unit.unit_code,
           quantity: 1,
         },
       ]);
       setScannedUnitCodes(prev => [...prev, unit.unit_code]);
       setSearchQuery('');
       setSearchResults([]);
       showPopupMessage('Unit Ditambahkan', `Unit "${unit.unit_code}" berhasil ditambahkan ke keranjang!`, 'success');
     };

     const removeItem = index => {
       setCart(prev => prev.filter((_, i) => i !== index));
       setScannedUnitCodes(prev => prev.filter((_, i) => i !== index));
     };

     const calculateSubtotal = () => {
       return cart.reduce((total, item) => {
         const price = item.discount_price !== null && item.discount_price !== undefined ? item.discount_price : item.selling_price;
         return total + (price || 0);
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

     const validateForm = async () => {
       if (cart.length === 0) {
         showPopupMessage('Keranjang Kosong', 'Tambahkan unit produk terlebih dahulu.', 'error');
         return false;
       }
       if (!paymentMethod) {
         showPopupMessage('Metode Pembayaran Kosong', 'Silakan pilih metode pembayaran!', 'error');
         return false;
       }
       if (paymentMethod === 'debit' && !cardType) {
         showPopupMessage('Tipe Kartu Kosong', 'Silakan pilih tipe kartu untuk metode pembayaran Debit!', 'error');
         return false;
       }
       const total = parseFloat(newTotal);
       if (newTotal === '' || isNaN(total) || total < 0) {
         showPopupMessage('Harga Baru Tidak Valid', 'Harga baru harus diisi dan tidak boleh kurang dari 0.', 'error');
         return false;
       }
       if (total > calculateSubtotal()) {
         showPopupMessage('Harga Baru Tidak Valid', 'Harga baru tidak boleh melebihi subtotal.', 'error');
         return false;
       }
       return true;
     };

     const submitTransaction = async () => {
       if (!(await validateForm())) return;

       setLoading(true);
       setErrorMessage('');
       try {
         const token = await AsyncStorage.getItem('token');
         if (!token) {
           setErrorMessage('Token tidak ditemukan. Silakan login kembali.');
           throw new Error('Token autentikasi tidak ditemukan.');
         }

         const response = await fetch('http://192.168.1.6:8000/api/transactions', {
           method: 'POST',
           headers: {
             Accept: 'application/json',
             'Content-Type': 'application/json',
             Authorization: `Bearer ${token}`,
           },
           body: JSON.stringify({
             customer_name: customerName,
             customer_phone: customerPhone,
             payment_method: paymentMethod,
             card_type: paymentMethod === 'debit' ? cardType : undefined,
             notes,
             discount_amount: parseFloat(newTotal) || calculateSubtotal(),
             products: cart.map(item => ({
               product_id: item.product_id,
               unit_code: item.unit_code,
               discount_price: item.discount_price,
               quantity: item.quantity,
             })),
           }),
         });

         const data = await response.json();
         if (!response.ok) {
           if (response.status === 401) {
             setErrorMessage('Sesi habis atau token tidak valid. Silakan login kembali.');
             await AsyncStorage.removeItem('token');
             navigation.navigate('Login');
           }
           throw new Error(data.message || `HTTP Error: ${response.status}`);
         }

         if (!data.success) {
           throw new Error(data.message || 'Gagal membuat transaksi.');
         }

         showPopupMessage('Transaksi Berhasil', 'Transaksi telah berhasil dibuat!', 'success');
         setCart([]);
         setCustomerName('');
         setCustomerPhone('');
         setPaymentMethod('');
         setCardType('');
         setNotes('');
         setNewTotal('');
         setScannedUnitCodes([]);
         setTimeout(() => {
           setShowPopup(false);
           navigation.navigate('Transaction');
         }, 2000);
       } catch (error) {
         showPopupMessage('Gagal Membuat Transaksi', error.message, 'error');
       } finally {
         setLoading(false);
       }
     };

     const formatRupiah = amount => 'Rp ' + new Intl.NumberFormat('id-ID').format(amount || 0);

     const renderUnit = ({ item }) => (
       <TouchableOpacity
         style={[styles.card, darkMode && styles.cardDark]}
         onPress={() => addToCart(item)}
       >
         <Text style={[styles.text, darkMode && styles.textDark]}>{item.product_name}</Text>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           {item.color}, Ukuran: {item.size}, Kode: {item.unit_code}
         </Text>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           {item.discount_price ? formatRupiah(item.discount_price) : formatRupiah(item.selling_price)}
         </Text>
         <TouchableOpacity
           style={[styles.button, darkMode && styles.buttonDark]}
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
           {item.color}, Ukuran: {item.size}, Kode: {item.unit_code}
         </Text>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           {item.discount_price ? formatRupiah(item.discount_price) : formatRupiah(item.selling_price)}
         </Text>
       </View>
     );

     const renderHeader = () => (
       <View>
         <View style={styles.header}>
           <Text style={[styles.headerText, darkMode && styles.textDark]}>Buat Transaksi Baru</Text>
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

         {errorMessage ? (
           <View style={[styles.card, darkMode && styles.cardDark]}>
             <Text style={[styles.text, darkMode && styles.textDark]}>{errorMessage}</Text>
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
         ) : null}

         <View style={[styles.card, darkMode && styles.cardDark]}>
           <Text style={[styles.text, darkMode && styles.textDark]}>Pilih Unit Produk</Text>
           <TextInput
             style={[styles.input, darkMode && styles.inputDark]}
             value={searchQuery}
             onChangeText={text => {
               setSearchQuery(text);
               searchUnits();
             }}
             placeholder="Cari nama, warna, ukuran, atau kode unit..."
             placeholderTextColor={darkMode ? '#aaa' : '#666'}
           />
           {searchResults.length > 0 && (
             <FlatList
               data={searchResults}
               renderItem={renderUnit}
               keyExtractor={item => item.unit_code}
               style={{ maxHeight: 200 }}
             />
           )}
           {loading ? (
             <View style={[styles.card, darkMode && styles.cardDark]}>
               <ActivityIndicator size="large" color={darkMode ? '#FBBF24' : '#D4AF37'} />
               <Text style={[styles.text, darkMode && styles.textDark]}>Memuat...</Text>
             </View>
           ) : availableUnits.length === 0 ? (
             <View style={[styles.card, darkMode && styles.cardDark]}>
               <Text style={[styles.text, darkMode && styles.textDark]}>Tidak ada unit produk tersedia.</Text>
             </View>
           ) : null}
         </View>

         <View style={[styles.card, darkMode && styles.cardDark]}>
           <Text style={[styles.text, darkMode && styles.textDark]}>Informasi Pelanggan</Text>
           <TextInput
             style={[styles.input, darkMode && styles.inputDark]}
             value={customerName}
             onChangeText={setCustomerName}
             placeholder="Nama Pelanggan"
             placeholderTextColor={darkMode ? '#aaa' : '#666'}
           />
           <TextInput
             style={[styles.input, darkMode && styles.inputDark]}
             value={customerPhone}
             onChangeText={setCustomerPhone}
             placeholder="No. Telepon"
             placeholderTextColor={darkMode ? '#aaa' : '#666'}
             keyboardType="phone-pad"
           />
           <Picker
             selectedValue={paymentMethod}
             onValueChange={value => {
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
             placeholderTextColor={darkMode ? '#aaa' : '#666'}
             multiline
           />
         </View>

         <View style={[styles.card, darkMode && styles.cardDark]}>
           <Text style={[styles.text, darkMode && styles.textDark]}>Keranjang Belanja</Text>
           {cart.length === 0 ? (
             <View style={[styles.card, darkMode && styles.cardDark]}>
               <Text style={[styles.text, darkMode && styles.textDark]}>Keranjang Kosong</Text>
               <Text style={[styles.text, darkMode && styles.textDark]}>
                 Tambahkan unit produk dari daftar di atas
               </Text>
             </View>
           ) : (
             <FlatList
               data={cart}
               renderItem={renderCartItem}
               keyExtractor={(item, index) => index.toString()}
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
               <Text style={[styles.text, darkMode && styles.textDark]}>Harga Baru: </Text>
               <TextInput
                 style={[styles.input, darkMode && styles.inputDark, { flex: 1 }]}
                 value={newTotal}
                 onChangeText={text => {
                   setNewTotal(text);
                   const total = parseFloat(text);
                   if (total > calculateSubtotal()) {
                     showPopupMessage('Harga Baru Tidak Valid', 'Harga baru tidak boleh melebihi subtotal.', 'error');
                     setNewTotal(calculateSubtotal().toString());
                   } else if (total < 0) {
                     showPopupMessage('Harga Baru Tidak Valid', 'Harga baru tidak boleh kurang dari 0.', 'error');
                     setNewTotal('');
                   }
                 }}
                 placeholder="Masukkan harga baru"
                 placeholderTextColor={darkMode ? '#aaa' : '#666'}
                 keyboardType="numeric"
               />
             </View>
             <Text style={[styles.text, darkMode && styles.textDark, { fontWeight: 'bold' }]}>
               Total Bayar: {formatRupiah(calculateTotal())}
             </Text>
             <TouchableOpacity
               style={[styles.button, darkMode && styles.buttonDark, { opacity: cart.length === 0 ? 0.5 : 1 }]}
               onPress={submitTransaction}
               disabled={cart.length === 0}
             >
               <Text style={styles.buttonText}>Proses Transaksi</Text>
             </TouchableOpacity>
           </View>
         </View>
       </View>
     );

     return (
       <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
         <FlatList
           data={availableUnits}
           renderItem={renderUnit}
           keyExtractor={item => item.unit_code}
           ListHeaderComponent={renderHeader}
           ListFooterComponent={<View style={{ height: 20 }} />}
         />
         <Modal visible={showPopup} transparent animationType="fade">
           <View style={styles.modal}>
             <View style={[styles.card, darkMode && styles.cardDark]}>
               <Text style={[styles.text, darkMode && styles.textDark, { fontWeight: 'bold' }]}>
                 {popupTitle}
               </Text>
               <Text style={[styles.text, darkMode && styles.textDark]}>{popupMessage}</Text>
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
     container: { flex: 1, backgroundColor: '#fff' },
     containerDark: { backgroundColor: '#333' },
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
     headerText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
     card: { padding: 16, margin: 8, backgroundColor: '#fff', borderRadius: 8 },
     cardDark: { backgroundColor: '#444' },
     text: { fontSize: 16, color: '#000' },
     textDark: { color: '#fff' },
     input: {
       borderWidth: 1,
       borderColor: '#ccc',
       padding: 8,
       marginVertical: 8,
       borderRadius: 8,
       color: '#000',
     },
     inputDark: { borderColor: '#666', color: '#fff', backgroundColor: '#555' },
     button: { backgroundColor: '#065F46', padding: 8, borderRadius: 8, margin: 4 },
     buttonDark: { backgroundColor: '#047857' },
     backButton: {
       backgroundColor: '#065F46',
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
     buttonText: { color: '#fff', textAlign: 'center' },
     modal: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
   });

   export default CreateTransactionScreen;