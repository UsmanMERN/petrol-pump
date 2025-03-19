import React, { useState, useEffect } from 'react';
import {
    Card, Row, Col, Statistic, Button, Table, Space,
    Typography, Progress, Select, DatePicker, message
} from 'antd';
import {
    DashboardOutlined, LineChartOutlined, BarChartOutlined,
    PieChartOutlined, DatabaseOutlined, ApiOutlined
} from '@ant-design/icons';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Line, Bar, Pie } from '@ant-design/plots';
import moment from 'moment';
import { db } from '../../../config/firebase';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const Dashboard = () => {
    const [tanks, setTanks] = useState([]);
    const [dispensers, setDispensers] = useState([]);
    const [nozzles, setNozzles] = useState([]);
    const [products, setProducts] = useState([]);
    const [readings, setReadings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState([moment().subtract(7, 'days'), moment()]);
    const [selectedProduct, setSelectedProduct] = useState('all');

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

            // Fetch readings with filters
            let readingsQuery = query(
                collection(db, 'readings'),
                where('timestamp', '>=', Timestamp.fromDate(selectedDateRange[0].toDate())),
                where('timestamp', '<=', Timestamp.fromDate(selectedDateRange[1].toDate())),
                orderBy('timestamp', 'desc')
            );

            if (selectedProduct !== 'all') {
                readingsQuery = query(
                    collection(db, 'readings'),
                    where('timestamp', '>=', Timestamp.fromDate(selectedDateRange[0].toDate())),
                    where('timestamp', '<=', Timestamp.fromDate(selectedDateRange[1].toDate())),
                    where('productId', '==', selectedProduct),
                    orderBy('timestamp', 'desc')
                );
            }

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

    // Calculate key metrics
    const totalSales = readings.reduce((sum, reading) => sum + reading.salesAmount, 0);
    const totalVolume = readings.reduce((sum, reading) => sum + reading.salesVolume, 0);
    const tankUtilization = tanks.length > 0
        ? (tanks.reduce((sum, tank) => sum + (tank.currentLevel / tank.capacity), 0) / tanks.length * 100).toFixed(2)
        : 0;

    // Product-wise sales
    const productSales = readings.reduce((acc, reading) => {
        const product = products.find(p => p.id === reading.productId);
        if (product) {
            acc[product.productName] = (acc[product.productName] || 0) + reading.salesAmount;
        }
        return acc;
    }, {});

    // Dispenser-wise sales
    const dispenserSales = readings.reduce((acc, reading) => {
        const dispenser = dispensers.find(d => d.id === reading.dispenserId);
        if (dispenser) {
            acc[dispenser.dispenserName] = (acc[dispenser.dispenserName] || 0) + reading.salesAmount;
        }
        return acc;
    }, {});

    // Chart data preparation
    const dailySalesData = [];
    const salesByDate = readings.reduce((acc, reading) => {
        const dateStr = moment(reading.timestamp).format('YYYY-MM-DD');
        acc[dateStr] = (acc[dateStr] || 0) + reading.salesAmount;
        return acc;
    }, {});
    Object.keys(salesByDate).sort().forEach(date => {
        dailySalesData.push({ date, sales: salesByDate[date] });
    });

    const productSalesData = Object.keys(productSales).map(product => ({
        type: product,
        value: productSales[product],
    }));

    const dispenserSalesData = Object.keys(dispenserSales).map(dispenser => ({
        dispenser,
        sales: dispenserSales[dispenser],
    }));

    // Recent transactions
    const recentTransactions = readings.slice(0, 10).map(reading => {
        const product = products.find(p => p.id === reading.productId);
        const dispenser = dispensers.find(d => d.id === reading.dispenserId);
        return {
            id: reading.id,
            date: moment(reading.timestamp).format('YYYY-MM-DD HH:mm'),
            product: product?.productName || 'Unknown',
            dispenser: dispenser?.dispenserName || 'Unknown',
            volume: reading.salesVolume.toFixed(2),
            amount: `₨${reading.salesAmount.toFixed(2)}`,
        };
    });

    // Event handlers
    const handleDateRangeChange = (dates) => setSelectedDateRange(dates);
    const handleProductChange = (value) => setSelectedProduct(value);

    return (
        <div className="dashboard-container" style={{ padding: '24px' }}>
            <div className="dashboard-header" style={{ marginBottom: 24 }}>
                <Space size="middle">
                    <RangePicker
                        value={selectedDateRange}
                        onChange={handleDateRangeChange}
                        style={{ width: 240 }}
                    />
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

            {/* Summary Stats */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} md={6}>
                    <Card bordered={false} hoverable>
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
                    <Card bordered={false} hoverable>
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
                    <Card bordered={false} hoverable>
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
                    <Card bordered={false} hoverable>
                        <Statistic
                            title="Tank Utilization"
                            value={tankUtilization}
                            precision={2}
                            valueStyle={{ color: '#faad14' }}
                            prefix={<DatabaseOutlined />}
                            suffix="%"
                        />
                        <Progress percent={tankUtilization} status="active" />
                    </Card>
                </Col>
            </Row>

            {/* Charts */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={16}>
                    <Card
                        title={<span><LineChartOutlined /> Daily Sales Trend</span>}
                        bordered={false}
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
                                        value: `₨${datum.sales.toFixed(2)}`,
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
                        bordered={false}
                        style={{ background: '#fff' }}
                    >
                        {productSalesData.length > 0 ? (
                            <Pie
                                data={productSalesData}
                                angleField="value"
                                colorField="type"
                                radius={0.8}
                                label={{ type: 'outer', content: '{name}: {percentage}' }}
                                tooltip={{
                                    formatter: datum => ({
                                        name: datum.type,
                                        value: `₨${datum.value.toFixed(2)}`,
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

            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    <Card
                        title={<span><BarChartOutlined /> Dispenser Performance</span>}
                        bordered={false}
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
                                        value: `₨${datum.sales.toFixed(2)}`,
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
                    <Card title="Recent Transactions" bordered={false} style={{ background: '#fff' }}>
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