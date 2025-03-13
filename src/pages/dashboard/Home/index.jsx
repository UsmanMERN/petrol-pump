import React, { useState, useEffect } from 'react';
import {
    Card,
    Statistic,
    Table,
    Button,
    DatePicker,
    Row,
    Col,
    Typography,
    Badge,
    Progress,
    Alert
} from 'antd';
import {
    ArrowUpOutlined,
    ArrowDownOutlined,
    DollarOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Dashboard content component that you can integrate into your existing layout
const DashboardContent = () => {
    const [fuelTypes, setFuelTypes] = useState([]);
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [todaySales, setTodaySales] = useState(0);
    const [monthlySales, setMonthlySales] = useState(0);
    const [loading, setLoading] = useState(true);

    const db = getFirestore();

    useEffect(() => {
        // Fetch data from Firebase
        const fetchData = async () => {
            try {
                // Fetch fuel types
                const fuelTypesSnapshot = await getDocs(collection(db, 'fuelTypes'));
                const fuelTypesData = fuelTypesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setFuelTypes(fuelTypesData);

                // Fetch recent transactions
                const transactionsQuery = query(
                    collection(db, 'transactions'),
                    orderBy('timestamp', 'desc'),
                    limit(10)
                );
                const transactionsSnapshot = await getDocs(transactionsQuery);
                const transactionsData = transactionsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    key: doc.id
                }));
                setRecentTransactions(transactionsData);

                // Calculate today's sales (mock data for now)
                setTodaySales(35890);
                setMonthlySales(980425);

                setLoading(false);
            } catch (error) {
                console.error("Error fetching data:", error);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Mock data for the fuel inventory chart
    const fuelInventoryData = [
        { name: 'Petrol', stock: 75, color: '#1890ff' },
        { name: 'Diesel', stock: 60, color: '#52c41a' },
        { name: 'Premium', stock: 45, color: '#faad14' },
        { name: 'CNG', stock: 90, color: '#722ed1' },
    ];

    // Table columns for recent transactions
    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            render: (text) => <a href="#">{text.substring(0, 8)}...</a>,
        },
        {
            title: 'Fuel Type',
            dataIndex: 'fuelType',
            key: 'fuelType',
        },
        {
            title: 'Quantity (L)',
            dataIndex: 'quantity',
            key: 'quantity',
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount) => `$${amount.toFixed(2)}`,
        },
        {
            title: 'Date',
            dataIndex: 'timestamp',
            key: 'timestamp',
            render: (timestamp) => new Date(timestamp?.toDate()).toLocaleString(),
        },
        {
            title: 'Status',
            key: 'status',
            dataIndex: 'status',
            render: (status) => (
                <span>
                    {status === 'completed' ? (
                        <Badge status="success" text="Completed" />
                    ) : status === 'pending' ? (
                        <Badge status="processing" text="In Progress" />
                    ) : (
                        <Badge status="error" text="Failed" />
                    )}
                </span>
            ),
        },
    ];

    return (
        <div className="p-4">
            <div className="mb-4">
                <Row gutter={[16, 16]} className="mb-4">
                    <Col xs={24} lg={8}>
                        {/* <Alert
                            message="Welcome to your dashboard"
                            description="Monitor your station's performance and manage fuel inventory in real-time."
                            type="info"
                            showIcon
                            closable
                            className="mb-3"
                        /> */}
                        <div className="d-flex justify-content-between">
                            <RangePicker className="me-2" />
                            <Button type="primary">Generate Report</Button>
                        </div>
                    </Col>
                </Row>

                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={6}>
                        <Card variant={false} className="shadow-sm">
                            <Statistic
                                title="Today's Sales"
                                value={todaySales}
                                precision={2}
                                valueStyle={{ color: '#3f8600' }}
                                prefix={<DollarOutlined />}
                                suffix="USD"
                            />
                            <div className="mt-2">
                                <Text type="success">
                                    <ArrowUpOutlined /> 8.5% from yesterday
                                </Text>
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card variant={false} className="shadow-sm">
                            <Statistic
                                title="Monthly Revenue"
                                value={monthlySales}
                                precision={2}
                                valueStyle={{ color: '#3f8600' }}
                                prefix={<DollarOutlined />}
                                suffix="USD"
                            />
                            <div className="mt-2">
                                <Text type="success">
                                    <ArrowUpOutlined /> 4.3% from last month
                                </Text>
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card variant={false} className="shadow-sm">
                            <Statistic
                                title="Average Transaction"
                                value={52.75}
                                precision={2}
                                valueStyle={{ color: '#cf1322' }}
                                prefix={<DollarOutlined />}
                            />
                            <div className="mt-2">
                                <Text type="danger">
                                    <ArrowDownOutlined /> 1.2% from last week
                                </Text>
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card variant={false} className="shadow-sm">
                            <Statistic
                                title="Total Transactions"
                                value={347}
                                valueStyle={{ color: '#1890ff' }}
                                prefix={<ClockCircleOutlined />}
                                suffix="today"
                            />
                            <div className="mt-2">
                                <Text type="success">
                                    <ArrowUpOutlined /> 12% from yesterday
                                </Text>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <Card
                        title="Recent Transactions"
                        variant={false}
                        className="shadow-sm"
                        extra={<Button type="link">View All</Button>}
                    >
                        <Table
                            columns={columns}
                            dataSource={loading ? [] : recentTransactions}
                            loading={loading}
                            pagination={{ pageSize: 5 }}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card
                        title="Fuel Inventory Status"
                        variant={false}
                        className="shadow-sm"
                        extra={<Button type="link">Manage</Button>}
                    >
                        {fuelInventoryData.map(item => (
                            <div key={item.name} className="mb-3">
                                <div className="d-flex justify-content-between mb-1">
                                    <Text>{item.name}</Text>
                                    <Text type={item.stock < 50 ? "danger" : "secondary"}>
                                        {item.stock}%
                                    </Text>
                                </div>
                                <Progress
                                    percent={item.stock}
                                    showInfo={false}
                                    strokeColor={item.color}
                                    status={item.stock < 20 ? "exception" : "normal"}
                                />
                            </div>
                        ))}
                        <div className="mt-4">
                            <Button type="primary" block>
                                Order Restock
                            </Button>
                        </div>
                    </Card>

                    <Card
                        title="Fuel Prices"
                        variant={false}
                        className="shadow-sm mt-4"
                        extra={<Button type="link">Update</Button>}
                    >
                        <ul className="list-unstyled">
                            <li className="d-flex justify-content-between mb-3">
                                <Text>Regular Petrol</Text>
                                <Text strong>$3.45/L</Text>
                            </li>
                            <li className="d-flex justify-content-between mb-3">
                                <Text>Premium Petrol</Text>
                                <Text strong>$3.75/L</Text>
                            </li>
                            <li className="d-flex justify-content-between mb-3">
                                <Text>Diesel</Text>
                                <Text strong>$3.20/L</Text>
                            </li>
                            <li className="d-flex justify-content-between">
                                <Text>CNG</Text>
                                <Text strong>$2.15/L</Text>
                            </li>
                        </ul>
                        <div className="mt-4">
                            <Button type="default" block>
                                Price History
                            </Button>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DashboardContent;