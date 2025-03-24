import React, { useState, useEffect } from 'react';
import {
    Card, Row, Col, Statistic, Button, Table, Space,
    Typography, Progress, Select, message
} from 'antd';
import {
    LineChartOutlined, BarChartOutlined,
    PieChartOutlined, DatabaseOutlined, ApiOutlined
} from '@ant-design/icons';
import { collection, getDocs, query, where, orderBy, Timestamp, limit } from 'firebase/firestore';
import { Line, Bar, Pie } from '@ant-design/plots';
import moment from 'moment';
import { db } from '../../../config/firebase';

const { Title } = Typography;
const { Option } = Select;

const Dashboard = () => {
    // State variables
    const [tanks, setTanks] = useState([]);
    const [dispensers, setDispensers] = useState([]);
    const [nozzles, setNozzles] = useState([]);
    const [products, setProducts] = useState([]);
    const [readings, setReadings] = useState([]);
    const [latestDipCharts, setLatestDipCharts] = useState({});
    const [loading, setLoading] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState({
        start: moment().subtract(7, 'days').format('YYYY-MM-DD'),
        end: moment().format('YYYY-MM-DD')
    });
    const [selectedProduct, setSelectedProduct] = useState('all');

    // Fetch dashboard data
    useEffect(() => {
        fetchDashboardData();
    }, [selectedDateRange, selectedProduct]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch tanks
            const tankSnapshot = await getDocs(collection(db, 'tanks'));
            const tankList = tankSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTanks(tankList);

            // Fetch latest dip charts for each tank
            const latestDipChartsPromises = tankList.map(tank =>
                getDocs(query(
                    collection(db, 'dipcharts'),
                    where('tankId', '==', tank.id),
                    orderBy('recordedAt', 'desc'),
                    limit(1)
                ))
            );
            const latestDipChartsResults = await Promise.all(latestDipChartsPromises);
            const latestDipChartsData = {};
            latestDipChartsResults.forEach((snapshot, index) => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    latestDipChartsData[tankList[index].id] = { id: doc.id, ...doc.data() };
                }
            });
            setLatestDipCharts(latestDipChartsData);

            // Fetch dispensers
            const dispenserSnapshot = await getDocs(collection(db, 'dispensers'));
            const dispenserList = dispenserSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDispensers(dispenserList);

            // Fetch nozzles
            const nozzleSnapshot = await getDocs(collection(db, 'nozzles'));
            const nozzleList = nozzleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNozzles(nozzleList);

            // Fetch products
            const productSnapshot = await getDocs(collection(db, 'products'));
            const productList = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(productList);

            // Construct readings query
            let readingsQuery = query(
                collection(db, 'readings'),
                where('timestamp', '>=', Timestamp.fromDate(moment(selectedDateRange.start).toDate())),
                where('timestamp', '<=', Timestamp.fromDate(moment(selectedDateRange.end).toDate())),
                orderBy('timestamp', 'desc')
            );

            // Add product filter if specific product is selected
            if (selectedProduct !== 'all') {
                readingsQuery = query(
                    collection(db, 'readings'),
                    where('timestamp', '>=', Timestamp.fromDate(moment(selectedDateRange.start).toDate())),
                    where('timestamp', '<=', Timestamp.fromDate(moment(selectedDateRange.end).toDate())),
                    where('productId', '==', selectedProduct),
                    orderBy('timestamp', 'desc')
                );
            }

            // Fetch readings
            const readingsSnapshot = await getDocs(readingsQuery);
            const readingsList = readingsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp.toDate(),
            }));
            setReadings(readingsList);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            message.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    // Metrics Calculations
    const totalSales = readings.reduce((sum, reading) => sum + (reading.salesAmount || 0), 0);
    const totalVolume = readings.reduce((sum, reading) => sum + (reading.salesVolume || 0), 0);
    const tankUtilization = tanks.length > 0
        ? (tanks.reduce((sum, tank) => sum + ((tank.remainingStock || 0) / (tank.capacity || 1)), 0) / tanks.length * 100).toFixed(2)
        : 0;

    // Product-wise sales
    const productSales = readings.reduce((acc, reading) => {
        const product = products.find(p => p.id === reading.productId);
        if (product) {
            acc[product.productName] = (acc[product.productName] || 0) + (reading.salesAmount || 0);
        }
        return acc;
    }, {});

    // Dispenser-wise sales
    const dispenserSales = readings.reduce((acc, reading) => {
        const dispenser = dispensers.find(d => d.id === reading.dispenserId);
        if (dispenser) {
            acc[dispenser.dispenserName] = (acc[dispenser.dispenserName] || 0) + (reading.salesAmount || 0);
        }
        return acc;
    }, {});

    // Chart Data Preparation
    const dailySalesData = [];
    const salesByDate = readings.reduce((acc, reading) => {
        const dateStr = moment(reading.timestamp).format('YYYY-MM-DD');
        acc[dateStr] = (acc[dateStr] || 0) + (reading.salesAmount || 0);
        return acc;
    }, {});
    Object.keys(salesByDate).sort().forEach(date => {
        dailySalesData.push({ date, sales: salesByDate[date] });
    });

    // Prepare chart-specific data with enhanced null checks
    const productSalesData = Object.keys(productSales)
        .filter(product => productSales[product] > 0 && productSales[product] !== null && productSales[product] !== undefined)
        .map(product => ({
            type: product,
            value: productSales[product],
        }));

    const dispenserSalesData = Object.keys(dispenserSales)
        .filter(dispenser => dispenserSales[dispenser] > 0 && dispenserSales[dispenser] !== null && dispenserSales[dispenser] !== undefined)
        .map(dispenser => ({
            dispenser,
            sales: dispenserSales[dispenser],
        }));

    // Recent Transactions
    const recentTransactions = readings.slice(0, 10).map(reading => {
        const product = products.find(p => p.id === reading.productId);
        const dispenser = dispensers.find(d => d.id === reading.dispenserId);
        return {
            id: reading.id,
            date: moment(reading.timestamp).format('YYYY-MM-DD HH:mm'),
            product: product?.productName || 'Unknown',
            dispenser: dispenser?.dispenserName || 'Unknown',
            volume: (reading.salesVolume || 0).toFixed(2),
            amount: `₨${(reading.salesAmount || 0).toFixed(2)}`,
        };
    });

    // Compute Tanks Metrics: Total Remaining Stock and Total Gain/Loss
    const computeTankMetrics = () => {
        let totalRemainingStock = 0;
        let totalGainLoss = 0;
        tanks.forEach(tank => {
            const tankRemainingStock = tank.remainingStock || 0;
            totalRemainingStock += tankRemainingStock;
            const latestDipChart = latestDipCharts[tank.id];
            if (latestDipChart) {
                const physicalVolume = latestDipChart.dipLiters || 0;
                const gainLoss = physicalVolume - tankRemainingStock;
                totalGainLoss += gainLoss;
            }
        });
        return { totalRemainingStock, totalGainLoss };
    };

    const { totalRemainingStock, totalGainLoss } = computeTankMetrics();

    // Tanks Table Data
    const tankTableData = tanks.map(tank => {
        const latestDipChart = latestDipCharts[tank.id];
        const physicalVolume = latestDipChart ? latestDipChart.dipLiters : null;
        const gainLoss = physicalVolume !== null ? physicalVolume - (tank.remainingStock || 0) : null;
        const latestDipDate = latestDipChart ? latestDipChart.recordedAt : null;
        return {
            ...tank,
            remainingStock: tank.remainingStock || 0,
            physicalVolume,
            gainLoss,
            latestDipDate,
        };
    });

    // Event Handlers
    const handleStartDateChange = (e) => {
        setSelectedDateRange(prev => ({ ...prev, start: e.target.value }));
    };

    const handleEndDateChange = (e) => {
        setSelectedDateRange(prev => ({ ...prev, end: e.target.value }));
    };

    const handleProductChange = (value) => setSelectedProduct(value);

    return (
        <div className="dashboard-container" style={{ padding: '24px' }}>
            {/* Dashboard Header */}
            <div className="dashboard-header" style={{ marginBottom: 24 }}>
                <Space size="middle">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <label style={{ marginRight: 8 }}>From:</label>
                        <input
                            type="date"
                            value={selectedDateRange.start}
                            onChange={handleStartDateChange}
                            style={{ marginRight: 16 }}
                        />
                        <label style={{ marginRight: 8 }}>To:</label>
                        <input
                            type="date"
                            value={selectedDateRange.end}
                            onChange={handleEndDateChange}
                        />
                    </div>
                    <Select
                        style={{ width: 180 }}
                        placeholder="Select Product"
                        value={selectedProduct}
                        onChange={handleProductChange}
                    >
                        <Option value="all">All Products</Option>
                        {products.map(product => (
                            <Option key={product.id} value={product.id}>
                                {product.productName}
                            </Option>
                        ))}
                    </Select>
                    <Button type="primary" onClick={fetchDashboardData} loading={loading}>
                        Refresh
                    </Button>
                </Space>
            </div>

            {/* Summary Statistics */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} md={6}>
                    <Card hoverable>
                        <Statistic
                            title="Total Sales (PKR)"
                            value={totalSales}
                            precision={2}
                            valueStyle={{ color: '#3f8600' }}
                            prefix="₨"
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card hoverable>
                        <Statistic
                            title="Total Volume Sold"
                            value={totalVolume}
                            precision={2}
                            valueStyle={{ color: '#1890ff' }}
                            suffix="L"
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card hoverable>
                        <Statistic
                            title="Active Dispensers"
                            value={dispensers.filter(d => d.status === 'active').length}
                            valueStyle={{ color: '#52c41a' }}
                            prefix={<ApiOutlined />}
                            suffix={` / ${dispensers.length}`}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card hoverable>
                        <Statistic
                            title="Tank Utilization (%)"
                            value={tankUtilization}
                            precision={2}
                            valueStyle={{ color: '#faad14' }}
                            prefix={<DatabaseOutlined />}
                            suffix="%"
                        />
                        <Progress percent={Number(tankUtilization)} status="active" />
                    </Card>
                </Col>
            </Row>

            {/* Tanks Metrics Section */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} md={6}>
                    <Card hoverable>
                        <Statistic
                            title="Total Remaining Stock (L)"
                            value={totalRemainingStock}
                            precision={2}
                            valueStyle={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card hoverable>
                        <Statistic
                            title="Total Gain/Loss (L)"
                            value={totalGainLoss}
                            precision={2}
                            valueStyle={{
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: totalGainLoss > 0 ? 'green' : totalGainLoss < 0 ? 'red' : 'black'
                            }}
                            formatter={value => value > 0 ? `+${value}` : `${value}`}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Tanks Opening Stock Section */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24}>
                    <Card title="Tanks Opening Stock" hoverable>
                        <Table
                            dataSource={tankTableData}
                            rowKey="id"
                            pagination={false}
                        >
                            <Table.Column title="Tank Name" dataIndex="tankName" key="tankName" />
                            <Table.Column
                                title="Opening Stock (L)"
                                dataIndex="openingStock"
                                key="openingStock"
                                render={value => value ? Number(value).toFixed(2) : '-'}
                            />
                            <Table.Column
                                title="Remaining Stock (L)"
                                dataIndex="remainingStock"
                                key="remainingStock"
                                render={value => Number(value).toFixed(2)}
                            />
                            <Table.Column
                                title="Latest Dip Volume (L)"
                                dataIndex="physicalVolume"
                                key="physicalVolume"
                                render={value => value !== null ? Number(value).toFixed(2) : '-'}
                            />
                            <Table.Column
                                title="Gain/Loss (L)"
                                dataIndex="gainLoss"
                                key="gainLoss"
                                render={value => value !== null ? (
                                    <span style={{ color: value > 0 ? 'green' : value < 0 ? 'red' : 'inherit' }}>
                                        {value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)}
                                    </span>
                                ) : '-'}
                            />
                            <Table.Column
                                title="Latest Dip Date"
                                dataIndex="latestDipDate"
                                key="latestDipDate"
                                render={date => date ? moment(date).format('YYYY-MM-DD HH:mm') : '-'}
                            />
                        </Table>
                    </Card>
                </Col>
            </Row>

            {/* Charts Section */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={16}>
                    <Card
                        title={<span><LineChartOutlined /> Daily Sales Trend</span>}
                        style={{ background: '#fff' }}
                    >
                        {dailySalesData.length > 0 ? (
                            <Line
                                data={dailySalesData}
                                padding="auto"
                                xField="date"
                                yField="sales"
                                point={{ size: 5, shape: 'diamond' }}
                                tooltip={{
                                    formatter: datum => ({
                                        name: 'Sales',
                                        value: `₨${(datum.sales || 0).toFixed(2)}`,
                                    }),
                                }}
                                xAxis={{ tickCount: 5 }}
                                height={300}
                            />
                        ) : (
                            <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                No data available for the selected period
                            </div>
                        )}
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card
                        title={<span><PieChartOutlined /> Product-wise Sales</span>}
                        style={{ background: '#fff' }}
                    >
                        {productSalesData.length > 0 ? (
                            <Pie
                                data={productSalesData}
                                angleField="value"
                                colorField="type"
                                radius={0.8}
                                label={{
                                    position: 'outside',
                                    content: datum => `${datum.type}: ${datum.value.toFixed(2)}`,
                                }}
                                tooltip={{
                                    formatter: datum => ({
                                        name: datum.type,
                                        value: `₨${(datum.value || 0).toFixed(2)}`,
                                    }),
                                }}
                                height={300}
                            />
                        ) : (
                            <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                No data available for the selected period
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Additional Charts */}
            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    <Card
                        title={<span><BarChartOutlined /> Dispenser Performance</span>}
                        style={{ background: '#fff' }}
                    >
                        {dispenserSalesData.length > 0 ? (
                            <Bar
                                data={dispenserSalesData}
                                xField="sales"
                                yField="dispenser"
                                seriesField="dispenser"
                                legend={false}
                                tooltip={{
                                    formatter: datum => ({
                                        name: datum.dispenser,
                                        value: `₨${(datum.sales || 0).toFixed(2)}`,
                                    }),
                                }}
                                height={300}
                            />
                        ) : (
                            <div style={{ height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                No data available for the selected period
                            </div>
                        )}
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card title="Recent Transactions" style={{ background: '#fff' }}>
                        <Table
                            dataSource={recentTransactions}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            columns={[
                                { title: 'Date & Time', dataIndex: 'date', key: 'date' },
                                { title: 'Product', dataIndex: 'product', key: 'product' },
                                { title: 'Dispenser', dataIndex: 'dispenser', key: 'dispenser' },
                                { title: 'Volume (L)', dataIndex: 'volume', key: 'volume' },
                                { title: 'Amount (PKR)', dataIndex: 'amount', key: 'amount' },
                            ]}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Dashboard;