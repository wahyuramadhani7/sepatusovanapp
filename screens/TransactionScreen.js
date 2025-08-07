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
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

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

  const getStatusColor = status => {
    const colors = {
      paid: '#10B981',
      pending: '#F59E0B',
      cancelled: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getPaymentIcon = method => {
    const icons = {
      cash: '💵',
      credit_card: '💳',
      debit_bri: '🏦',
      debit_bca: '🏦',
      debit_mandiri: '🏦',
      transfer: '📱',
    };
    return icons[method] || '💳';
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

  const renderTransaction = ({ item, index }) => (
    <View style={[
      styles.card, 
      darkMode && styles.cardDark,
      { opacity: loading ? 0.7 : 1 }
    ]}>
      <View style={styles.cardHeader}>
        <View style={styles.invoiceContainer}>
          <Text style={[styles.invoiceText, darkMode && styles.textDark]}>
            {item.invoice_number}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.payment_status) }]}>
            <Text style={styles.statusText}>{translateStatus(item.payment_status)}</Text>
          </View>
        </View>
        <Text style={[styles.amountText, darkMode && styles.textDark]}>
          {formatRupiah(item.final_amount)}
        </Text>
      </View>
      
      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <Text style={[styles.label, darkMode && styles.textDark]}>👤 Pelanggan:</Text>
          <Text style={[styles.value, darkMode && styles.textDark]} numberOfLines={1}>
            {item.customer_name || '-'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={[styles.label, darkMode && styles.textDark]}>📦 Produk:</Text>
          <Text style={[styles.value, darkMode && styles.textDark]} numberOfLines={2}>
            {getProductNames(item.items)}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={[styles.label, darkMode && styles.textDark]}>
            {getPaymentIcon(item.payment_method)} Metode:
          </Text>
          <Text style={[styles.value, darkMode && styles.textDark]}>
            {translatePaymentMethod(item.payment_method)}
          </Text>
        </View>
        
        {calculateDiscount(item) > 0 && (
          <View style={styles.infoRow}>
            <Text style={[styles.label, darkMode && styles.textDark]}>🏷️ Diskon:</Text>
            <Text style={[styles.value, styles.discountText]}>
              {formatRupiah(calculateDiscount(item))}
            </Text>
          </View>
        )}
        
        <View style={styles.infoRow}>
          <Text style={[styles.label, darkMode && styles.textDark]}>📝 Catatan:</Text>
          <Text style={[styles.value, darkMode && styles.textDark]} numberOfLines={2}>
            {item.note || 'Tidak ada catatan'}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.noteButton, darkMode && styles.noteButtonDark]}
        onPress={() => openNotesModal(item.id, item.note)}
        activeOpacity={0.8}
      >
        <Text style={styles.noteButtonText}>✏️ Edit Catatan</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View>
      <View style={[styles.header, darkMode && styles.headerDark]}>
        <View style={styles.titleContainer}>
          <Text style={[styles.headerText, darkMode && styles.textDark]}>👟 Sepatu by Sovan</Text>
          <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>
            Kelola Transaksi Harian
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => setDarkMode(!darkMode)}
            style={[styles.iconButton, darkMode && styles.iconButtonDark]}
            activeOpacity={0.8}
          >
            <Text style={styles.iconText}>{darkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={fetchTransactions} 
            style={[styles.actionButton, darkMode && styles.actionButtonDark]}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>🔄 Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, darkMode && styles.primaryButtonDark]}
            onPress={() => navigation.navigate('CreateTransaction')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>➕ Transaksi Baru</Text>
          </TouchableOpacity>
        </View>
      </View>

      {errorMessage ? (
        <View style={[styles.errorCard, darkMode && styles.errorCardDark]}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorText, darkMode && styles.textDark]}>{errorMessage}</Text>
          <TouchableOpacity
            style={[styles.errorButton, darkMode && styles.errorButtonDark]}
            onPress={async () => {
              setErrorMessage('');
              await AsyncStorage.removeItem('token');
              navigation.navigate('Login');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.errorButtonText}>🔐 Login Ulang</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.filterCard, darkMode && styles.filterCardDark]}>
        <Text style={[styles.filterTitle, darkMode && styles.textDark]}>🔍 Filter Transaksi</Text>
        
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, darkMode && styles.textDark]}>📅 Tanggal</Text>
          <Pressable 
            onPress={() => setShowDatePicker(true)}
            style={[styles.dateInput, darkMode && styles.dateInputDark]}
          >
            <Text style={[styles.dateText, darkMode && styles.textDark]}>
              {dateFilter.toLocaleDateString('id-ID', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
              })}
            </Text>
            <Text style={[styles.dateIcon, darkMode && styles.textDark]}>📅</Text>
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
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, darkMode && styles.textDark]}>💳 Metode Pembayaran</Text>
          <View style={[styles.pickerContainer, darkMode && styles.pickerContainerDark]}>
            <Picker
              selectedValue={paymentMethodFilter}
              onValueChange={value => {
                setPaymentMethodFilter(value);
                fetchTransactions();
              }}
              style={[styles.picker, darkMode && styles.pickerDark]}
            >
              <Picker.Item label="Semua Metode" value="" />
              <Picker.Item label="💵 Tunai" value="cash" />
              <Picker.Item label="💳 QRIS" value="credit_card" />
              <Picker.Item label="🏦 Debit (BRI)" value="debit_bri" />
              <Picker.Item label="🏦 Debit (BCA)" value="debit_bca" />
              <Picker.Item label="🏦 Debit (Mandiri)" value="debit_mandiri" />
              <Picker.Item label="📱 Transfer" value="transfer" />
            </Picker>
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, darkMode && styles.textDark]}>📊 Status Pembayaran</Text>
          <View style={[styles.pickerContainer, darkMode && styles.pickerContainerDark]}>
            <Picker
              selectedValue={statusFilter}
              onValueChange={value => {
                setStatusFilter(value);
                fetchTransactions();
              }}
              style={[styles.picker, darkMode && styles.pickerDark]}
            >
              <Picker.Item label="Semua Status" value="" />
              <Picker.Item label="✅ Lunas" value="paid" />
              <Picker.Item label="⏳ Pending" value="pending" />
              <Picker.Item label="❌ Dibatalkan" value="cancelled" />
            </Picker>
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.resetButton, darkMode && styles.resetButtonDark]}
          onPress={resetFilters}
          activeOpacity={0.8}
        >
          <Text style={styles.resetButtonText}>🔄 Reset Filter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={[styles.loadingCard, darkMode && styles.loadingCardDark]}>
          <ActivityIndicator size="large" color={darkMode ? '#FBBF24' : '#D4AF37'} />
          <Text style={[styles.loadingText, darkMode && styles.textDark]}>⏳ Memuat transaksi...</Text>
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View style={[styles.emptyCard, darkMode && styles.emptyCardDark]}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={[styles.emptyText, darkMode && styles.textDark]}>
            Tidak ada transaksi ditemukan
          </Text>
          <Text style={[styles.emptySubtext, darkMode && styles.subtitleDark]}>
            Coba ubah filter atau tambah transaksi baru
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderFooter = () => (
    <View style={[styles.paginationCard, darkMode && styles.paginationCardDark]}>
      <Text style={[styles.paginationInfo, darkMode && styles.textDark]}>
        📄 Halaman {currentPage} dari {totalPages} ({filteredTransactions.length} transaksi)
      </Text>
      <View style={styles.paginationButtons}>
        <TouchableOpacity
          style={[
            styles.paginationButton, 
            darkMode && styles.paginationButtonDark,
            currentPage === 1 && styles.paginationButtonDisabled
          ]}
          onPress={prevPage}
          disabled={currentPage === 1}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.paginationButtonText,
            currentPage === 1 && styles.paginationButtonTextDisabled
          ]}>⬅️ Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.paginationButton, 
            darkMode && styles.paginationButtonDark,
            currentPage >= totalPages && styles.paginationButtonDisabled
          ]}
          onPress={nextPage}
          disabled={currentPage >= totalPages}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.paginationButtonText,
            currentPage >= totalPages && styles.paginationButtonTextDisabled
          ]}>Next ➡️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.containerDark]}>
      <StatusBar 
        barStyle={darkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={darkMode ? '#1F2937' : '#F9FAFB'} 
      />
      <FlatList
        data={paginatedTransactions}
        renderItem={renderTransaction}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
      
      <Modal visible={showNotesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.textDark]}>✏️ Edit Catatan Transaksi</Text>
              <TouchableOpacity
                onPress={() => setShowNotesModal(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseText}>❌</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.modalInput, darkMode && styles.modalInputDark]}
              multiline
              numberOfLines={4}
              value={currentNote}
              onChangeText={setCurrentNote}
              placeholder="Masukkan catatan transaksi..."
              placeholderTextColor={darkMode ? '#9CA3AF' : '#6B7280'}
              textAlignVertical="top"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, darkMode && styles.modalButtonSecondaryDark]}
                onPress={() => setShowNotesModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>❌ Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, darkMode && styles.modalButtonPrimaryDark]}
                onPress={saveNote}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonText}>💾 Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F9FAFB' 
  },
  containerDark: { 
    backgroundColor: '#111827' 
  },
  listContent: {
    paddingBottom: 20,
  },
  
  // Header Styles
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },
  titleContainer: {
    marginBottom: 12,
  },
  headerText: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  iconButton: {
    backgroundColor: '#F3F4F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonDark: {
    backgroundColor: '#374151',
  },
  iconText: {
    fontSize: 18,
  },
  actionButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonDark: {
    backgroundColor: '#374151',
  },
  actionButtonText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonDark: {
    backgroundColor: '#047857',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  
  // Card Styles
  card: { 
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  cardDark: { 
    backgroundColor: '#1F2937',
    shadowColor: '#000',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cardHeaderDark: {
    backgroundColor: '#111827',
    borderBottomColor: '#374151',
  },
  invoiceContainer: {
    flex: 1,
    marginRight: 12,
  },
  invoiceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
    textAlign: 'right',
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    width: 100,
    marginRight: 12,
  },
  value: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
    fontWeight: '500',
  },
  discountText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  
  // Button Styles
  noteButton: {
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  noteButtonDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  noteButtonText: {
    color: '#1D4ED8',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Filter Card Styles
  filterCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  filterCardDark: {
    backgroundColor: '#1F2937',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  dateInputDark: {
    borderColor: '#4B5563',
    backgroundColor: '#374151',
  },
  dateText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  dateIcon: {
    fontSize: 18,
  },
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  pickerContainerDark: {
    borderColor: '#4B5563',
    backgroundColor: '#374151',
  },
  picker: {
    height: 50,
  },
  pickerDark: {
    color: '#FFFFFF',
  },
  resetButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  resetButtonDark: {
    backgroundColor: '#D97706',
  },
  resetButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Error Card Styles
  errorCard: {
    backgroundColor: '#FEF2F2',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  errorCardDark: {
    backgroundColor: '#7F1D1D',
    borderColor: '#DC2626',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  errorButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonDark: {
    backgroundColor: '#EF4444',
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Loading Card Styles
  loadingCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingCardDark: {
    backgroundColor: '#1F2937',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  
  // Empty Card Styles
  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyCardDark: {
    backgroundColor: '#1F2937',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Pagination Styles
  paginationCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  paginationCardDark: {
    backgroundColor: '#1F2937',
  },
  paginationInfo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  paginationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  paginationButton: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  paginationButtonDark: {
    backgroundColor: '#047857',
  },
  paginationButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  paginationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  paginationButtonTextDisabled: {
    color: '#9CA3AF',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalContentDark: {
    backgroundColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    marginBottom: 24,
    minHeight: 100,
    fontWeight: '500',
  },
  modalInputDark: {
    borderColor: '#4B5563',
    backgroundColor: '#374151',
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalButtonPrimary: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  modalButtonPrimaryDark: {
    backgroundColor: '#047857',
  },
  modalButtonSecondary: {
    backgroundColor: '#6B7280',
    shadowColor: '#6B7280',
  },
  modalButtonSecondaryDark: {
    backgroundColor: '#4B5563',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalButtonTextSecondary: {
    color: '#FFFFFF',
  },
  
  // Text Styles
  text: { 
    fontSize: 16, 
    color: '#1F2937',
    fontWeight: '500',
  },
  textDark: { 
    color: '#F9FAFB' 
  },
});

export default TransactionScreen;