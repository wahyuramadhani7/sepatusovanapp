   import React, { useState, useEffect, useCallback } from 'react';
   import {
     View,
     Text,
     FlatList,
     TouchableOpacity,
     StyleSheet,
     ActivityIndicator,
     Modal,
     TextInput,
     SafeAreaView,
     Platform,
     Pressable,
   } from 'react-native';
   import AsyncStorage from '@react-native-async-storage/async-storage';
   import { Picker } from '@react-native-picker/picker';
   import DateTimePicker from '@react-native-community/datetimepicker';

   const TransactionScreen = ({ navigation }) => {
     const [darkMode, setDarkMode] = useState(false);
     const [transactions, setTransactions] = useState([]);
     const [filteredTransactions, setFilteredTransactions] = useState([]);
     const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
     const [statusFilter, setStatusFilter] = useState('');
     const [dateFilter, setDateFilter] = useState(new Date());
     const [showDatePicker, setShowDatePicker] = useState(false);
     const [currentPage, setCurrentPage] = useState(1);
     const [perPage, setPerPage] = useState(10);
     const [loading, setLoading] = useState(false);
     const [errorMessage, setErrorMessage] = useState('');
     const [showNotesModal, setShowNotesModal] = useState(false);
     const [currentNote, setCurrentNote] = useState('');
     const [currentTransactionId, setCurrentTransactionId] = useState(null);

     useEffect(() => {
       AsyncStorage.getItem('darkMode').then(value => {
         if (value) setDarkMode(JSON.parse(value));
       });
       fetchTransactions();
     }, [fetchTransactions]);

     useEffect(() => {
       AsyncStorage.setItem('darkMode', JSON.stringify(darkMode));
     }, [darkMode]);

     const fetchTransactions = useCallback(async () => {
       setLoading(true);
       setErrorMessage('');
       try {
         const token = await AsyncStorage.getItem('token');
         console.log('Token di AsyncStorage:', token);
         if (!token) {
           setErrorMessage('Token tidak ditemukan. Silakan login kembali.');
           throw new Error('Token autentikasi tidak ditemukan.');
         }

         const formattedDate = dateFilter.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
         const response = await fetch(
           `http://192.168.1.6:8000/api/transactions?date=${formattedDate}&payment_method=${paymentMethodFilter}&status=${statusFilter}`,
           {
             method: 'GET',
             headers: {
               Accept: 'application/json',
               Authorization: `Bearer ${token}`,
             },
           }
         );

         const responseText = await response.text();
         console.log('Raw Response:', responseText);
         console.log('Response Status:', response.status);

         let data;
         try {
           data = JSON.parse(responseText);
         } catch (parseError) {
           console.error('JSON Parse Error:', parseError);
           throw new Error('Respons server tidak valid (bukan JSON).');
         }

         if (!response.ok) {
           if (response.status === 401) {
             setErrorMessage('Sesi habis atau token tidak valid. Silakan login kembali.');
             await AsyncStorage.removeItem('token');
             navigation.navigate('Login');
           }
           throw new Error(`HTTP Error: ${response.status}`);
         }

         if (!data.success) {
           throw new Error(data.message || 'Gagal mengambil data transaksi.');
         }
         if (!data.data || !data.data.transactions) {
           throw new Error('Data transaksi tidak ditemukan.');
         }

         const storedNotes = JSON.parse((await AsyncStorage.getItem('transactionNotes')) || '{}');
         const updatedTransactions = data.data.transactions.map(transaction => ({
           ...transaction,
           total_amount: parseFloat(transaction.total_amount) || 0,
           final_amount: parseFloat(transaction.final_amount) || 0,
           note: storedNotes[transaction.id] || '',
         }));
         setTransactions(updatedTransactions);
         setFilteredTransactions(updatedTransactions);
         setCurrentPage(1);
       } catch (error) {
         setErrorMessage(error.message);
         setFilteredTransactions([]);
         console.error('Fetch error:', error.message);
       } finally {
         setLoading(false);
       }
     }, [dateFilter, paymentMethodFilter, statusFilter, navigation]);

     const formatRupiah = amount => 'Rp ' + new Intl.NumberFormat('id-ID').format(amount || 0);

     const calculateDiscount = transaction => (transaction.total_amount || 0) - (transaction.final_amount || 0);

     const translatePaymentMethod = method => {
       const methods = {
         cash: 'Tunai',
         credit_card: 'QRIS',
         debit_bri: 'Debit (BRI)',
         debit_bca: 'Debit (BCA)',
         debit_mandiri: 'Debit (Mandiri)',
         transfer: 'Transfer',
       };
       return methods[method] || method;
     };

     const translateStatus = status => {
       const statuses = { paid: 'Lunas', pending: 'Pending', cancelled: 'Dibatalkan' };
       return statuses[status] || status;
     };

     const getProductNames = items =>
       items && items.length ? items.map(item => item.product_name || '-').join(', ') : '-';

     const resetFilters = () => {
       setPaymentMethodFilter('');
       setStatusFilter('');
       setDateFilter(new Date());
       fetchTransactions();
     };

     const openNotesModal = (transactionId, note) => {
       setCurrentTransactionId(transactionId);
       setCurrentNote(note || '');
       setShowNotesModal(true);
     };

     const saveNote = async () => {
       if (currentTransactionId) {
         const storedNotes = JSON.parse((await AsyncStorage.getItem('transactionNotes')) || '{}');
         storedNotes[currentTransactionId] = currentNote.trim();
         await AsyncStorage.setItem('transactionNotes', JSON.stringify(storedNotes));
         const updatedTransactions = transactions.map(t =>
           t.id === currentTransactionId ? { ...t, note: currentNote.trim() } : t
         );
         setTransactions(updatedTransactions);
         setFilteredTransactions(updatedTransactions);
       }
       setShowNotesModal(false);
       setCurrentTransactionId(null);
       setCurrentNote('');
     };

     const totalPages = Math.ceil(filteredTransactions.length / perPage);
     const paginatedTransactions = filteredTransactions.slice(
       (currentPage - 1) * perPage,
       currentPage * perPage
     );

     const prevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);
     const nextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);

     const onDateChange = (event, selectedDate) => {
       const currentDate = selectedDate || dateFilter;
       setShowDatePicker(Platform.OS === 'ios');
       setDateFilter(currentDate);
       fetchTransactions();
     };

     const renderTransaction = ({ item }) => (
       <View style={[styles.card, darkMode && styles.cardDark]}>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           {item.invoice_number} - {formatRupiah(item.final_amount)}
         </Text>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           Pelanggan: {item.customer_name || '-'}
         </Text>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           Produk: {getProductNames(item.items)}
         </Text>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           Metode: {translatePaymentMethod(item.payment_method)}
         </Text>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           Status: {translateStatus(item.payment_status)}
         </Text>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           Diskon: {formatRupiah(calculateDiscount(item))}
         </Text>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           Catatan: {item.note || '-'}
         </Text>
         <TouchableOpacity
           style={[styles.button, darkMode && styles.buttonDark]}
           onPress={() => openNotesModal(item.id, item.note)}
         >
           <Text style={styles.buttonText}>Tambah Catatan</Text>
         </TouchableOpacity>
       </View>
     );

     const renderHeader = () => (
       <View>
         <View style={styles.header}>
           <Text style={[styles.headerText, darkMode && styles.textDark]}>Sepatu by Sovan</Text>
           <View style={styles.headerButtons}>
             <TouchableOpacity onPress={() => setDarkMode(!darkMode)}>
               <Text style={styles.text}>{darkMode ? '☀️' : '🌙'}</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={fetchTransactions} style={styles.refreshButton}>
               <Text style={styles.buttonText}>↻ Refresh</Text>
             </TouchableOpacity>
             <TouchableOpacity
               style={styles.createButton}
               onPress={() => navigation.navigate('CreateTransaction')}
             >
               <Text style={styles.buttonText}>+ Transaksi Baru</Text>
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
           <Text style={[styles.text, darkMode && styles.textDark]}>Filter Transaksi</Text>
           <Pressable onPress={() => setShowDatePicker(true)}>
             <View style={[styles.input, darkMode && styles.inputDark]}>
               <Text style={[styles.text, darkMode && styles.textDark]}>
                 {dateFilter.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
               </Text>
             </View>
           </Pressable>
           {showDatePicker && (
             <DateTimePicker
               value={dateFilter}
               mode="date"
               display={Platform.OS === 'ios' ? 'inline' : 'default'}
               onChange={onDateChange}
               maximumDate={new Date()}
               locale="id-ID"
             />
           )}
           <Picker
             selectedValue={paymentMethodFilter}
             onValueChange={value => {
               setPaymentMethodFilter(value);
               fetchTransactions();
             }}
             style={[styles.input, darkMode && styles.inputDark]}
           >
             <Picker.Item label="Semua Metode" value="" />
             <Picker.Item label="Tunai" value="cash" />
             <Picker.Item label="QRIS" value="credit_card" />
             <Picker.Item label="Debit (BRI)" value="debit_bri" />
             <Picker.Item label="Debit (BCA)" value="debit_bca" />
             <Picker.Item label="Debit (Mandiri)" value="debit_mandiri" />
             <Picker.Item label="Transfer" value="transfer" />
           </Picker>
           <Picker
             selectedValue={statusFilter}
             onValueChange={value => {
               setStatusFilter(value);
               fetchTransactions();
             }}
             style={[styles.input, darkMode && styles.inputDark]}
           >
             <Picker.Item label="Semua Status" value="" />
             <Picker.Item label="Lunas" value="paid" />
             <Picker.Item label="Pending" value="pending" />
             <Picker.Item label="Dibatalkan" value="cancelled" />
           </Picker>
           <TouchableOpacity
             style={[styles.button, darkMode && styles.buttonDark]}
             onPress={resetFilters}
           >
             <Text style={styles.buttonText}>Reset Filter</Text>
           </TouchableOpacity>
         </View>

         {loading ? (
           <View style={[styles.card, darkMode && styles.cardDark]}>
             <ActivityIndicator size="large" color={darkMode ? '#FBBF24' : '#D4AF37'} />
             <Text style={[styles.text, darkMode && styles.textDark]}>Memuat...</Text>
           </View>
         ) : filteredTransactions.length === 0 ? (
           <View style={[styles.card, darkMode && styles.cardDark]}>
             <Text style={[styles.text, darkMode && styles.textDark]}>Tidak ada transaksi.</Text>
           </View>
         ) : null}
       </View>
     );

     const renderFooter = () => (
       <View style={[styles.card, darkMode && styles.cardDark]}>
         <Text style={[styles.text, darkMode && styles.textDark]}>
           Halaman {currentPage} dari {totalPages}
         </Text>
         <View style={styles.pagination}>
           <TouchableOpacity
             style={[styles.button, darkMode && styles.buttonDark, currentPage === 1 && styles.disabled]}
             onPress={prevPage}
             disabled={currentPage === 1}
           >
             <Text style={styles.buttonText}>Prev</Text>
           </TouchableOpacity>
           <TouchableOpacity
             style={[styles.button, darkMode && styles.buttonDark, currentPage >= totalPages && styles.disabled]}
             onPress={nextPage}
             disabled={currentPage >= totalPages}
           >
             <Text style={styles.buttonText}>Next</Text>
           </TouchableOpacity>
         </View>
       </View>
     );

     return (
       <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
         <FlatList
           data={paginatedTransactions}
           renderItem={renderTransaction}
           keyExtractor={item => item.id.toString()}
           ListHeaderComponent={renderHeader}
           ListFooterComponent={renderFooter}
         />
         <Modal visible={showNotesModal} transparent animationType="fade">
           <View style={styles.modal}>
             <View style={[styles.card, darkMode && styles.cardDark]}>
               <Text style={[styles.text, darkMode && styles.textDark]}>Catatan Transaksi</Text>
               <TextInput
                 style={[styles.input, darkMode && styles.inputDark]}
                 multiline
                 value={currentNote}
                 onChangeText={setCurrentNote}
                 placeholder="Masukkan catatan..."
                 placeholderTextColor={darkMode ? '#aaa' : '#666'}
               />
               <View style={styles.pagination}>
                 <TouchableOpacity
                   style={[styles.button, darkMode && styles.buttonDark]}
                   onPress={() => setShowNotesModal(false)}
                 >
                   <Text style={styles.buttonText}>Batal</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={[styles.button, darkMode && styles.buttonDark]}
                   onPress={saveNote}
                 >
                   <Text style={styles.buttonText}>Simpan</Text>
                 </TouchableOpacity>
               </View>
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
       justifyContent: 'center',
     },
     inputDark: { borderColor: '#666', color: '#fff', backgroundColor: '#555' },
     button: { backgroundColor: '#065F46', padding: 8, borderRadius: 8, margin: 4 },
     buttonDark: { backgroundColor: '#047857' },
     refreshButton: {
       backgroundColor: '#065F46',
       padding: 8,
       borderRadius: 8,
       marginLeft: 8,
     },
     createButton: {
       backgroundColor: '#065F46',
       padding: 8,
       borderRadius: 8,
       marginLeft: 8,
     },
     buttonText: { color: '#fff', textAlign: 'center' },
     disabled: { opacity: 0.5 },
     pagination: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
     modal: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
   });

   export default TransactionScreen;