import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  Alert,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';

const TransactionScreen = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  const [currentTransactionId, setCurrentTransactionId] = useState(null);
  const [newTransactionId, setNewTransactionId] = useState(null);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('darkMode').then(value => {
      if (value) setDarkMode(JSON.parse(value));
    });
    fetchTransactions();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const fetchTransactions = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(
        `http://192.168.1.6:8000/api/transactions?date=${dateFilter}&payment_method=${paymentMethodFilter}&status=${statusFilter}`
      );
      if (!response.ok) throw new Error('Gagal mengambil data transaksi.');
      const data = await response.json();
      if (!data.success) throw new Error(data.message || 'Gagal mengambil data transaksi.');
      const storedNotes = JSON.parse((await AsyncStorage.getItem('transactionNotes')) || '{}');
      const updatedTransactions = data.transactions.map(transaction => ({
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
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = amount =>
    'Rp ' + new Intl.NumberFormat('id-ID').format(amount || 0);

  const calculateDiscount = transaction =>
    (transaction.total_amount || 0) - (transaction.final_amount || 0);

  const formatTime = dateString =>
    dateString
      ? new Date(dateString).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Jakarta',
        })
      : '-';

  const translatePaymentMethod = (method, cardType) => {
    const methods = {
      cash: 'Tunai',
      credit_card: 'QRIS',
      debit: cardType ? `Debit (${cardType})` : 'Debit',
      transfer: 'Transfer Bank',
    };
    return methods[method] || method;
  };

  const translateStatus = status => {
    const statuses = {
      paid: 'Lunas',
      pending: 'Pending',
      cancelled: 'Dibatalkan',
    };
    return statuses[status] || status;
  };

  const getProductNames = items =>
    items && items.length
      ? items
          .map(
            item =>
              `${item.product?.name || '-'} (${
                item.product?.size || '-'}${item.product?.color ? ', ' + item.product.color : ''})`
          )
          .join(', ')
      : '-';

  const resetFilters = () => {
    setPaymentMethodFilter('');
    setStatusFilter('');
    setDateFilter(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
    fetchTransactions();
  };

  const openNotesModal = (transactionId, note) => {
    setCurrentTransactionId(transactionId);
    setCurrentNote(note || '');
    setShowNotesModal(true);
  };

  const closeNotesModal = () => {
    setShowNotesModal(false);
    setCurrentTransactionId(null);
    setCurrentNote('');
  };

  const saveNote = async () => {
    if (currentTransactionId) {
      const transaction = transactions.find(t => t.id === currentTransactionId);
      if (transaction) {
        transaction.note = currentNote.trim();
        setTransactions([...transactions]);
        setFilteredTransactions([...transactions]);
      }
      const storedNotes = JSON.parse((await AsyncStorage.getItem('transactionNotes')) || '{}');
      storedNotes[currentTransactionId] = currentNote.trim();
      await AsyncStorage.setItem('transactionNotes', JSON.stringify(storedNotes));
    }
    closeNotesModal();
  };

  const totalPages = Math.ceil(filteredTransactions.length / perPage);

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPage = page => {
    if (typeof page === 'number') {
      setCurrentPage(Math.min(Math.max(1, page), totalPages));
    }
  };

  const paginationFrom = () =>
    filteredTransactions.length ? (currentPage - 1) * perPage + 1 : 0;

  const paginationTo = () => Math.min(currentPage * perPage, filteredTransactions.length);

  const displayedPages = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    let pages = [];
    if (currentPage <= 3) pages = [1, 2, 3, 4, '…', totalPages];
    else if (currentPage >= totalPages - 2)
      pages = [1, '…', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    else pages = [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages];
    return pages;
  };

  const renderTransaction = ({ item }) => (
    <View
      style={[
        styles.card,
        darkMode ? styles.cardDark : styles.cardLight,
        item.id === newTransactionId && (darkMode ? styles.newTransactionDark : styles.newTransactionLight),
      ]}
    >
      <View style={styles.transactionHeader}>
        <View>
          <Text style={[styles.transactionTitle, darkMode && styles.textDark]}>
            {item.invoice_number}
          </Text>
          <Text style={[styles.transactionTime, darkMode && styles.textDark]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
        <View style={styles.transactionActions}>
          <TouchableOpacity
            onPress={() => openNotesModal(item.id, item.note)}
            style={[styles.actionButton, darkMode && styles.actionButtonDark]}
          >
            <Text style={[styles.actionIcon, darkMode && styles.textDark]}>📝</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Cetak Struk', 'Fitur cetak struk akan diimplementasikan.')}
            style={[styles.actionButton, darkMode && styles.actionButtonDark]}
          >
            <Text style={[styles.actionIcon, darkMode && styles.textDark]}>🖨️</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.transactionDetails}>
        <View style={styles.detailItem}>
          <Text style={[styles.label, darkMode && styles.textDark]}>Pelanggan</Text>
          <Text style={[styles.value, darkMode && styles.textDark]}>
            {item.customer_name || 'Tanpa Nama'}
          </Text>
          <Text style={[styles.subValue, darkMode && styles.textDark]}>
            {item.customer_phone || '-'}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.label, darkMode && styles.textDark]}>Produk</Text>
          <Text style={[styles.value, darkMode && styles.textDark]}>
            {getProductNames(item.items)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.label, darkMode && styles.textDark]}>Metode</Text>
          <Text
            style={[
              styles.badge,
              item.payment_method === 'cash' && styles.badgeSuccess,
              item.payment_method === 'credit_card' && styles.badgeNeutral,
              (item.payment_method === 'transfer' || item.payment_method === 'debit') &&
                styles.badgeInfo,
              darkMode && styles.badgeDark,
            ]}
          >
            {translatePaymentMethod(item.payment_method, item.card_type)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.label, darkMode && styles.textDark]}>Diskon</Text>
          <Text style={[styles.value, styles.goldText]}>{formatRupiah(calculateDiscount(item))}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.label, darkMode && styles.textDark]}>Total</Text>
          <Text style={[styles.value, styles.goldText]}>{formatRupiah(item.final_amount)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.label, darkMode && styles.textDark]}>Status</Text>
          <Text
            style={[
              styles.badge,
              item.payment_status === 'paid' && styles.badgeSuccess,
              item.payment_status === 'pending' && styles.badgeWarning,
              item.payment_status === 'cancelled' && styles.badgeDanger,
              darkMode && styles.badgeDark,
            ]}
          >
            {translateStatus(item.payment_status)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.label, darkMode && styles.textDark]}>Catatan</Text>
          <Text style={[styles.value, darkMode && styles.textDark]}>
            {item.note || '-'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, darkMode ? styles.containerDark : styles.containerLight]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, darkMode ? styles.headerDark : styles.headerLight]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, darkMode && styles.textDark]}>
            Sepatu by Sovan
          </Text>
          <Text style={[styles.headerSubtitle, darkMode && styles.textDark]}>
            Luxury Footwear Collection
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setDarkMode(!darkMode)}
          style={[styles.headerButton, darkMode && styles.headerButtonDark]}
        >
          <Text style={[styles.headerIcon, darkMode && styles.textDark]}>
            {darkMode ? '☀️' : '🌙'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.main}>
        {errorMessage ? (
          <View style={[styles.alert, styles.alertError, darkMode && styles.alertDark]}>
            <Text style={[styles.alertText, darkMode && styles.textDark]}>
              {errorMessage}
            </Text>
            <TouchableOpacity onPress={() => setErrorMessage('')}>
              <Text style={[styles.alertIcon, darkMode && styles.textDark]}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          <View style={styles.pageHeader}>
            <Text style={[styles.pageTitle, darkMode && styles.textDark]}>
              Sistem Kasir
            </Text>
            <Text style={[styles.pageSubtitle, darkMode && styles.textDark]}>
              Daftar Transaksi
            </Text>
          </View>
          <View style={styles.pageActions}>
            <TouchableOpacity
              style={[styles.button, darkMode && styles.buttonDark]}
              onPress={() => Alert.alert('Transaksi Baru', 'Fitur ini akan diimplementasikan.')}
            >
              <Text style={styles.buttonText}>+ Transaksi Baru</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, darkMode && styles.buttonDark]}
              onPress={() => Alert.alert('Laporan Penjualan', 'Fitur ini akan diimplementasikan.')}
            >
              <Text style={styles.buttonText}>📊 Laporan Penjualan</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, darkMode && styles.textDark]}>
              Filter Transaksi
            </Text>
            <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
              <Text style={[styles.filterIcon, darkMode && styles.textDark]}>
                {showFilters ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
          </View>
          {showFilters && (
            <View style={styles.filterContent}>
              <View style={styles.filterItem}>
                <Text style={[styles.label, darkMode && styles.textDark]}>Tanggal</Text>
                <TextInput
                  style={[styles.input, darkMode && styles.inputDark]}
                  value={dateFilter}
                  onChangeText={text => {
                    setDateFilter(text);
                    fetchTransactions();
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={darkMode ? '#D1D5DB' : '#6B7280'}
                />
              </View>
              <View style={styles.filterItem}>
                <Text style={[styles.label, darkMode && styles.textDark]}>
                  Metode Pembayaran
                </Text>
                <Picker
                  selectedValue={paymentMethodFilter}
                  onValueChange={value => {
                    setPaymentMethodFilter(value);
                    fetchTransactions();
                  }}
                  style={[styles.picker, darkMode && styles.pickerDark]}
                >
                  <Picker.Item label="Semua Metode" value="" />
                  <Picker.Item label="Tunai" value="cash" />
                  <Picker.Item label="QRIS" value="credit_card" />
                  <Picker.Item label="Debit" value="debit" />
                  <Picker.Item label="Transfer" value="transfer" />
                </Picker>
              </View>
              <View style={styles.filterItem}>
                <Text style={[styles.label, darkMode && styles.textDark]}>
                  Status Pembayaran
                </Text>
                <Picker
                  selectedValue={statusFilter}
                  onValueChange={value => {
                    setStatusFilter(value);
                    fetchTransactions();
                  }}
                  style={[styles.picker, darkMode && styles.pickerDark]}
                >
                  <Picker.Item label="Semua Status" value="" />
                  <Picker.Item label="Lunas" value="paid" />
                  <Picker.Item label="Pending" value="pending" />
                  <Picker.Item label="Dibatalkan" value="cancelled" />
                </Picker>
              </View>
              <TouchableOpacity
                style={[styles.button, darkMode && styles.buttonDark]}
                onPress={resetFilters}
              >
                <Text style={styles.buttonText}>🔄 Reset Filter</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={[styles.card, darkMode ? styles.cardDark : styles.cardLight]}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={darkMode ? '#FBBF24' : '#D4AF37'} />
              <Text style={[styles.loadingText, darkMode && styles.textDark]}>
                Memuat transaksi...
              </Text>
            </View>
          ) : filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, darkMode && styles.textDark]}>
                Tidak Ada Transaksi
              </Text>
              <Text style={[styles.emptyText, darkMode && styles.textDark]}>
                Belum ada transaksi untuk filter yang dipilih.
              </Text>
              <TouchableOpacity
                style={[styles.button, darkMode && styles.buttonDark]}
                onPress={() => Alert.alert('Transaksi Baru', 'Fitur ini akan diimplementasikan.')}
              >
                <Text style={styles.buttonText}>+ Buat Transaksi Baru</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <FlatList
                data={paginatedTransactions}
                renderItem={renderTransaction}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.transactionList}
              />
              <View style={styles.pagination}>
                <Text style={[styles.paginationText, darkMode && styles.textDark]}>
                  Menampilkan {paginationFrom()} - {paginationTo()} dari{' '}
                  {filteredTransactions.length} transaksi
                </Text>
                <View style={styles.paginationControls}>
                  <Picker
                    selectedValue={perPage}
                    onValueChange={value => {
                      setPerPage(value);
                      fetchTransactions();
                    }}
                    style={[styles.paginationPicker, darkMode && styles.pickerDark]}
                  >
                    <Picker.Item label="10" value={10} />
                    <Picker.Item label="25" value={25} />
                    <Picker.Item label="50" value={50} />
                  </Picker>
                  <View style={styles.paginationButtons}>
                    <TouchableOpacity
                      onPress={prevPage}
                      disabled={currentPage === 1}
                      style={[
                        styles.paginationButton,
                        darkMode && styles.paginationButtonDark,
                        currentPage === 1 && styles.disabledButton,
                      ]}
                    >
                      <Text style={[styles.paginationIcon, darkMode && styles.textDark]}>◄</Text>
                    </TouchableOpacity>
                    {displayedPages().map((page, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => typeof page === 'number' && goToPage(page)}
                        style={[
                          styles.paginationButton,
                          darkMode && styles.paginationButtonDark,
                          page === currentPage && styles.activePage,
                        ]}
                        disabled={page === '…'}
                      >
                        <Text style={[styles.paginationText, darkMode && styles.textDark]}>
                          {page}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={nextPage}
                      disabled={currentPage >= totalPages}
                      style={[
                        styles.paginationButton,
                        darkMode && styles.paginationButtonDark,
                        currentPage >= totalPages && styles.disabledButton,
                      ]}
                    >
                      <Text style={[styles.paginationIcon, darkMode && styles.textDark]}>►</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
        <Modal visible={showNotesModal} transparent animationType="fade" onRequestClose={closeNotesModal}>
          <View style={styles.modal}>
            <View style={[styles.modalContent, darkMode ? styles.cardDark : styles.cardLight]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
                  Catatan Transaksi
                </Text>
                <TouchableOpacity onPress={closeNotesModal}>
                  <Text style={[styles.modalIcon, darkMode && styles.textDark]}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.label, darkMode && styles.textDark]}>
                Catatan (misal: salah metode pembayaran, mesin error)
              </Text>
              <TextInput
                style={[styles.textarea, darkMode && styles.inputDark]}
                multiline
                numberOfLines={4}
                value={currentNote}
                onChangeText={setCurrentNote}
                placeholder="Masukkan catatan untuk transaksi ini..."
                placeholderTextColor={darkMode ? '#D1D5DB' : '#6B7280'}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.button, darkMode && styles.buttonDark]}
                  onPress={closeNotesModal}
                >
                  <Text style={styles.buttonText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, darkMode && styles.buttonDark]}
                  onPress={saveNote}
                >
                  <Text style={styles.buttonText}>✔ Simpan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {newTransactionId && (
          <TouchableOpacity
            style={[styles.floatingButton, darkMode && styles.floatingButtonDark]}
            onPress={() => Alert.alert('Cetak Struk', 'Fitur cetak struk akan diimplementasikan.')}
          >
            <Text style={styles.floatingIcon}>🖨️</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  containerDark: { backgroundColor: '#1F2937' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
  },
  headerDark: {
    backgroundColor: 'rgba(31, 41, 55, 0.98)',
    borderBottomColor: 'rgba(251, 191, 36, 0.2)',
  },
  headerLeft: { flexDirection: 'column' },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'Roboto',
  },
  headerSubtitle: { fontSize: 14, color: '#6B7280' },
  headerButton: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  headerButtonDark: { backgroundColor: '#374151' },
  headerIcon: { fontSize: 20, color: '#1F2937' },
  main: { padding: 16 },
  alert: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  alertError: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  alertDark: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#B91C1C' },
  alertText: { fontSize: 16, color: '#1F2937', fontWeight: '600' },
  alertIcon: { fontSize: 20, color: '#6B7280' },
  card: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D4AF37',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDark: { backgroundColor: '#1F2937', borderColor: '#FBBF24' },
  cardLight: { backgroundColor: '#FFFFFF' },
  pageHeader: { marginBottom: 12 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  pageSubtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  pageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
    paddingBottom: 8,
  },
  filterTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937' },
  filterIcon: { fontSize: 20, color: '#6B7280' },
  filterContent: { paddingTop: 12 },
  filterItem: { marginBottom: 12 },
  label: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
  },
  inputDark: { backgroundColor: '#374151', borderColor: '#FBBF24', color: '#F3F4F6' },
  picker: { borderWidth: 1, borderColor: '#D4AF37', borderRadius: 8, backgroundColor: '#F9FAFB', color: '#1F2937' },
  pickerDark: { backgroundColor: '#374151', borderColor: '#FBBF24', color: '#F3F4F6' },
  button: {
    backgroundColor: '#065F46',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  buttonDark: { backgroundColor: '#047857', borderColor: '#FBBF24' },
  buttonText: { color: '#FAFAFA', fontSize: 16, fontWeight: '600' },
  loading: { alignItems: 'center', padding: 32 },
  loadingText: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  transactionList: { paddingBottom: 16 },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
    paddingBottom: 8,
    marginBottom: 8,
  },
  transactionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  transactionTime: { fontSize: 14, color: '#6B7280' },
  transactionActions: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  actionButtonDark: { backgroundColor: '#374151' },
  actionIcon: { fontSize: 20, color: '#1F2937' },
  transactionDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailItem: { width: '48%' },
  value: { fontSize: 16, color: '#1F2937', fontWeight: '500' },
  subValue: { fontSize: 14, color: '#6B7280' },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  badgeSuccess: { backgroundColor: 'rgba(6, 95, 70, 0.15)', color: '#10B981', borderWidth: 1, borderColor: 'rgba(6, 95, 70, 0.3)' },
  badgeWarning: { backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#EAB308', borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.3)' },
  badgeDanger: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  badgeNeutral: { backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#9CA3AF', borderWidth: 1, borderColor: 'rgba(107, 114, 128, 0.3)' },
  badgeInfo: { backgroundColor: 'rgba(6, 95, 70, 0.15)', color: '#10B981', borderWidth: 1, borderColor: 'rgba(6, 95, 70, 0.3)' },
  badgeDark: { backgroundColor: 'rgba(209, 213, 219, 0.15)', borderColor: 'rgba(209, 213, 219, 0.3)', color: '#D1D5DB' },
  goldText: { color: '#D4AF37' },
  newTransactionLight: { backgroundColor: 'rgba(212, 175, 55, 0.1)' },
  newTransactionDark: { backgroundColor: 'rgba(251, 191, 36, 0.2)' },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
  },
  paginationText: { fontSize: 14, color: '#6B7280' },
  paginationControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paginationPicker: { width: 80, backgroundColor: '#F3F4F6', borderRadius: 8 },
  paginationButtons: { flexDirection: 'row', gap: 8 },
  paginationButton: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  paginationButtonDark: { backgroundColor: '#374151' },
  activePage: { backgroundColor: '#065F46' },
  disabledButton: { opacity: 0.5 },
  paginationIcon: { fontSize: 16, color: '#1F2937' },
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  modalContent: { width: '90%', maxWidth: 400, padding: 16, borderRadius: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937' },
  modalIcon: { fontSize: 20, color: '#6B7280' },
  textarea: {
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  floatingButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#065F46',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingButtonDark: { backgroundColor: '#047857', borderColor: '#FBBF24' },
  floatingIcon: { fontSize: 24, color: '#D4AF37' },
  textDark: { color: '#F3F4F6' },
});

export default TransactionScreen;