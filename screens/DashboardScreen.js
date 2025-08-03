import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalUnits, setTotalUnits] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [hourlyData, setHourlyData] = useState([]);
  const [hourlyLabels, setHourlyLabels] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);

  // Fungsi fetch data
  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('Token tidak ditemukan. Silakan login ulang.');
      }

      const response = await axios.get('http://192.168.1.6:8000/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('API Response:', JSON.stringify(response.data, null, 2));

      const {
        total_products = 0,
        total_transactions = 0,
        total_sales = '0',
        hourly_data = [],
        labels = [],
        top_products = [],
        recent_transactions = [],
      } = response.data.data || {};

      // Log jumlah transaksi
      console.log('Recent Transactions Count:', recent_transactions.length);

      // Cek apakah data berubah sebelum update state
      if (
        totalUnits !== total_products ||
        totalTransactions !== total_transactions ||
        totalSales !== parseFloat(total_sales) ||
        JSON.stringify(hourlyData) !== JSON.stringify(hourly_data) ||
        JSON.stringify(hourlyLabels) !== JSON.stringify(labels) ||
        JSON.stringify(topProducts) !== JSON.stringify(top_products) ||
        JSON.stringify(recentTransactions) !== JSON.stringify(recent_transactions)
      ) {
        setTotalUnits(total_products);
        setTotalTransactions(total_transactions);
        setTotalSales(parseFloat(total_sales) || 0);
        setHourlyData(hourly_data);
        setHourlyLabels(labels);
        setTopProducts(top_products);
        setRecentTransactions(recent_transactions);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error.message);
      console.error('Error details:', error.response?.data || error);
      const errorMsg = error.response?.status === 401
        ? 'Sesi login habis. Silakan login ulang.'
        : 'Gagal mengambil data dari API';
      setError(errorMsg);
      setLoading(false);
      Alert.alert('Error', errorMsg, [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    }
  }, [totalUnits, totalTransactions, totalSales, hourlyData, hourlyLabels, topProducts, recentTransactions, navigation]);

  // Polling setiap 5 detik
  useEffect(() => {
    fetchData(); // Fetch awal
    const interval = setInterval(fetchData, 5000); // Fetch setiap 5 detik
    return () => clearInterval(interval); // Bersihin interval
  }, [fetchData]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
    setMenuVisible(false);
  };

  // Batasi hourlyData sampai jam sekarang
  const currentHour = new Date().getHours();
  const filteredHourlyData = hourlyData.slice(0, currentHour + 1).filter(data => data > 0);
  const filteredHourlyLabels = hourlyLabels.slice(0, currentHour + 1).filter((_, index) => hourlyData[index] > 0);

  // Render item untuk tabel transaksi
  const renderTransaction = ({ item, index }) => (
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 1 }]}>{item.id || '-'}</Text>
      <Text style={[styles.tableCell, { flex: 2 }]}>{item.created_at || '-'}</Text>
      <Text style={[styles.tableCell, { flex: 2 }]}>{item.user?.name || 'Unknown'}</Text>
      <Text style={[styles.tableCell, { flex: 3 }]}>
        {item.items?.length ? item.items.map(i => i.product?.name || '-').join(', ') : '-'}
      </Text>
      <Text style={[styles.tableCell, { flex: 2 }]}>Rp {(item.final_amount || 0).toLocaleString('id-ID')}</Text>
      <Text style={[styles.tableCell, { flex: 1.5, color: '#10B981' }]}>{item.status || '-'}</Text>
    </View>
  );

  // Render header untuk FlatList utama
  const renderHeader = () => (
    <>
      {/* Header with Hamburger Menu */}
      <View style={styles.headerContainer}>
        <View style={styles.heroSection}>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroText}>@SEPATUBYSOVAN</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.hamburgerButton} onPress={() => setMenuVisible(true)}>
          <Ionicons name="menu" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Daily Report Section */}
        <Text style={styles.sectionTitle}>LAPORAN HARIAN</Text>
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Unit</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardValue}>{totalUnits}</Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Transaksi Hari Ini</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardValue}>{totalTransactions}</Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Penjualan Hari Ini</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardValue}>Rp {totalSales.toLocaleString('id-ID')}</Text>
            </View>
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.dataContainer}>
          {/* Transaksi Harian */}
          <View style={styles.dataCard}>
            <Text style={styles.dataTitle}>Transaksi Harian</Text>
            <Text style={styles.dataSubtitle}>
              Laporan Transaksi Per Jam Hari Ini (hingga {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)
            </Text>
            {filteredHourlyData.length === 0 ? (
              <Text style={styles.noDataText}>
                Tidak ada transaksi hari ini hingga {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </Text>
            ) : (
              filteredHourlyData.map((data, index) => (
                <Text key={index} style={styles.dataText}>
                  {filteredHourlyLabels[index]}: {data} transaksi
                </Text>
              ))
            )}
          </View>

          {/* Produk Terlaris */}
          <View style={styles.dataCard}>
            <Text style={styles.dataTitle}>Produk Terlaris</Text>
            <Text style={styles.dataSubtitle}>
              Laporan Produk Terlaris Bulan Ini ({new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })})
            </Text>
            {topProducts.length === 0 ? (
              <Text style={styles.noDataText}>Tidak ada data produk terlaris</Text>
            ) : (
              topProducts.map((product, index) => (
                <Text key={index} style={styles.dataText}>
                  {product.name || '-'}: {product.quantity || 0} unit
                </Text>
              ))
            )}
          </View>
        </View>

        {/* Transactions Table */}
        <View style={styles.tableContainer}>
          <Text style={styles.sectionTitle}>Detail Transaksi</Text>
          {recentTransactions.length === 0 ? (
            <Text style={styles.noDataText}>Tidak ada transaksi hari ini</Text>
          ) : (
            <FlatList
              data={recentTransactions}
              renderItem={renderTransaction}
              keyExtractor={(item, index) => item.id?.toString() || `transaction-${index}`}
              ListHeaderComponent={
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>ID</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Tanggal</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Kasir</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Produk</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Total</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Status</Text>
                </View>
              }
              nestedScrollEnabled={true}
              // Hapus maxHeight biar tabel ngembang sesuai data
            />
          )}
        </View>
      </View>
    </>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF4500" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.replace('Login')}>
          <Text style={styles.buttonText}>Kembali ke Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={[{ key: 'dashboard' }]} // Data dummy biar FlatList render header
        renderItem={() => null} // Nggak render apa-apa di item
        ListHeaderComponent={renderHeader}
        style={styles.container}
      />
      {/* Modal untuk hamburger menu */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setMenuVisible(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { navigation.navigate('Inventory'); setMenuVisible(false); }}>
              <Text style={styles.menuText}>Lihat Inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { navigation.navigate('Transaction'); setMenuVisible(false); }}>
              <Text style={styles.menuText}>Buat Transaksi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { navigation.navigate('Visitor'); setMenuVisible(false); }}>
              <Text style={styles.menuText}>Monitoring Pengunjung</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { backgroundColor: '#FF4500' }]} onPress={handleLogout}>
              <Text style={styles.menuText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#FF4500', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  headerContainer: {
    position: 'relative',
  },
  heroSection: {
    height: 150,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 15,
    borderRadius: 8,
  },
  heroText: {
    color: '#FF4500',
    fontSize: 22,
    fontWeight: 'bold',
  },
  hamburgerButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
    backgroundColor: '#1F2937',
    borderRadius: 5,
  },
  content: { padding: 15 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
    color: '#1F2937',
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    width: '30%',
    marginBottom: 10,
  },
  cardTitle: {
    backgroundColor: '#E5E7EB',
    color: '#1F2937',
    padding: 8,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  cardContent: {
    padding: 10,
    alignItems: 'center',
  },
  cardValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dataContainer: { marginBottom: 15 },
  dataCard: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  dataTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  dataSubtitle: {
    color: '#9CA3AF',
    fontSize: 10,
    marginBottom: 8,
  },
  dataText: {
    color: '#D1D5DB',
    fontSize: 12,
    marginVertical: 2,
  },
  noDataText: {
    color: '#D1D5DB',
    textAlign: 'center',
    padding: 15,
    fontSize: 12,
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 10,
  },
  tableHeaderCell: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#4B5563',
  },
  tableCell: {
    color: '#D1D5DB',
    fontSize: 10,
    textAlign: 'left',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  menuItem: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});