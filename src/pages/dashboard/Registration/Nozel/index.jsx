import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Space, Card,
    Typography, message, Tooltip, Popconfirm, InputNumber, Select, Statistic, Row, Col
} from 'antd';
import moment from 'moment';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, DashboardOutlined, HistoryOutlined, LoadingOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';
import { useAuth } from '../../../../context/AuthContext';

const { Title } = Typography;
const { Option } = Select;

const NozzleManagement = () => {
    // Main data states
    const [nozzles, setNozzles] = useState([]);
    const [dispensers, setDispensers] = useState([]);
    const [products, setProducts] = useState([]);
    const [tanks, setTanks] = useState([]);

    // Modal visibility states
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isReadingModalVisible, setIsReadingModalVisible] = useState(false);
    const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);

    // Reading history and selected nozzle
    const [selectedNozzle, setSelectedNozzle] = useState(null);
    const [readingHistory, setReadingHistory] = useState([]);

    // Form instances
    const [form] = Form.useForm();
    const [readingForm] = Form.useForm();

    // Edit mode and loading indicators
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [recordReadingLoading, setRecordReadingLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    const { isAdmin } = useAuth();

    useEffect(() => {
        fetchNozzles();
        fetchDispensers();
        fetchProducts();
        fetchTanks();
    }, []);

    const fetchNozzles = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "nozzles"));
            const nozzleList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setNozzles(nozzleList);
        } catch (error) {
            message.error(`Failed to fetch nozzles: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchDispensers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "dispensers"));
            const dispenserList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setDispensers(dispenserList);
        } catch (error) {
            message.error(`Failed to fetch dispensers: ${error.message}`);
        }
    };

    const fetchProducts = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            const productList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProducts(productList);
        } catch (error) {
            message.error(`Failed to fetch products: ${error.message}`);
        }
    };

    const fetchTanks = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "tanks"));
            const tankList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTanks(tankList);
        } catch (error) {
            message.error(`Failed to fetch tanks: ${error.message}`);
        }
    };

    const fetchReadingHistory = async (nozzleId) => {
        try {
            const querySnapshot = await getDocs(collection(db, "readings"));
            const readings = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(reading => reading.nozzleId === nozzleId)
                .sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
            setReadingHistory(readings);
            setIsHistoryModalVisible(true);
        } catch (error) {
            message.error(`Failed to fetch reading history: ${error.message}`);
        }
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue(record);
        } else {
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({ openingReading: 0 });
        }
        setIsModalVisible(true);
    };

    const showReadingModal = (record) => {
        setSelectedNozzle(record);
        readingForm.setFieldsValue({
            nozzleId: record.id,
            previousReading: record.lastReading || 0,
            currentReading: '',
            tankId: undefined,
            newPrice: undefined,
        });
        setIsReadingModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleReadingCancel = () => {
        setIsReadingModalVisible(false);
        readingForm.resetFields();
    };

    const handleHistoryCancel = () => {
        setIsHistoryModalVisible(false);
        setReadingHistory([]);
    };

    const handleSubmit = async (values) => {
        setSubmitLoading(true);
        try {
            const currentTime = new Date();
            const formattedValues = { ...values, lastUpdated: currentTime };
            if (editingId) {
                await updateDoc(doc(db, "nozzles", editingId), formattedValues);
                message.success("Nozzle updated successfully");
            } else {
                await addDoc(collection(db, "nozzles"), {
                    ...formattedValues,
                    lastReading: values.openingReading,
                    totalSales: 0,
                    createdAt: currentTime,
                });
                message.success("Nozzle created successfully");
            }
            setIsModalVisible(false);
            fetchNozzles();
        } catch (error) {
            message.error(`Operation failed: ${error.message}`);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleReadingSubmit = async (values) => {
        setRecordReadingLoading(true);
        try {
            const { currentReading, previousReading, tankId, newPrice } = values;
            const salesVolume = currentReading - previousReading;

            // Validation checks
            if (salesVolume < 0) {
                message.error("Current reading cannot be less than previous reading");
                setRecordReadingLoading(false);
                return;
            }

            // Find the product to compute sales amount
            const product = products.find(p => p.id === selectedNozzle.productId);
            if (!product) {
                message.error("Linked product not found");
                setRecordReadingLoading(false);
                return;
            }

            // Check tank volume
            const selectedTank = tanks.find(t => t.id === tankId);
            if (!selectedTank) {
                message.error("Selected tank not found");
                setRecordReadingLoading(false);
                return;
            }
            if (typeof selectedTank.openingStock !== 'number' || selectedTank.openingStock < salesVolume) {
                message.error(`Not enough volume in tank "${selectedTank.tankName}". Available: ${selectedTank.openingStock}, Required: ${salesVolume}`);
                setRecordReadingLoading(false);
                return;
            }

            const salesAmount = salesVolume * product.salesPrice;

            // Database updates
            // 1. Update nozzle
            await updateDoc(doc(db, "nozzles", selectedNozzle.id), {
                lastReading: currentReading,
                totalSales: (selectedNozzle.totalSales || 0) + salesAmount,
                lastUpdated: new Date(),
            });

            // 2. Record reading
            await addDoc(collection(db, "readings"), {
                nozzleId: selectedNozzle.id,
                dispenserId: selectedNozzle.dispenserId,
                productId: selectedNozzle.productId,
                tankId,
                previousReading,
                currentReading,
                salesVolume,
                salesAmount,
                timestamp: new Date(),
            });

            // 3. Update product price if provided
            if (newPrice !== undefined && newPrice !== null) {
                await updateDoc(doc(db, "products", selectedNozzle.productId), {
                    salesPrice: newPrice,
                    lastUpdated: new Date(),
                });
            }

            // 4. Update tank volume
            const tankRef = doc(db, "tanks", tankId);
            const newVolume = selectedTank.openingStock - salesVolume;
            await updateDoc(tankRef, {
                openingStock: newVolume,
                lastUpdated: new Date(),
            });

            message.success(`Tank volume updated: ${selectedTank.openingStock} → ${newVolume}`);
            message.success("Reading recorded successfully");
            setIsReadingModalVisible(false);
            fetchNozzles();
            fetchTanks();
        } catch (error) {
            message.error(`Operation failed: ${error.message}`);
        } finally {
            setRecordReadingLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setDeleteLoading(id);
        try {
            await deleteDoc(doc(db, "nozzles", id));
            message.success("Nozzle deleted successfully");
            fetchNozzles();
        } catch (error) {
            message.error(`Delete failed: ${error.message}`);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleExportToExcel = () => {
        setExporting(true);
        try {
            exportToExcel(nozzles, 'Nozzles');
            message.success("Nozzles exported successfully");
        } catch (error) {
            message.error(`Export failed: ${error.message}`);
        } finally {
            setExporting(false);
        }
    };

    const columns = [
        {
            title: 'Dispenser',
            dataIndex: 'dispenserId',
            key: 'dispenserId',
            render: (dispenserId) => {
                const dispenser = dispensers.find(d => d.id === dispenserId);
                return dispenser ? dispenser.dispenserName : 'Unknown';
            },
            filters: dispensers.map(d => ({ text: d.dispenserName, value: d.id })),
            onFilter: (value, record) => record.dispenserId === value,
        },
        {
            title: 'Product',
            dataIndex: 'productId',
            key: 'productId',
            render: (productId) => {
                const product = products.find(p => p.id === productId);
                return product ? product.productName : 'Unknown';
            },
            filters: products.map(p => ({ text: p.productName, value: p.id })),
            onFilter: (value, record) => record.productId === value,
        },
        {
            title: 'Last Reading',
            dataIndex: 'lastReading',
            key: 'lastReading',
            sorter: (a, b) => a.lastReading - b.lastReading,
        },
        {
            title: 'Total Sales (PKR)',
            dataIndex: 'totalSales',
            key: 'totalSales',
            render: (sales) => `₨${sales?.toFixed(2) || '0.00'}`,
            sorter: (a, b) => (a.totalSales || 0) - (b.totalSales || 0),
        },
        {
            title: 'Last Updated',
            dataIndex: 'lastUpdated',
            key: 'lastUpdated',
            render: (lastUpdated) => lastUpdated ? moment(lastUpdated.toDate()).format('DD/MM/YYYY HH:mm:ss') : 'Never',
            sorter: (a, b) => {
                if (!a.lastUpdated) return -1;
                if (!b.lastUpdated) return 1;
                return a.lastUpdated.toDate() - b.lastUpdated.toDate();
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Record Reading">
                        <Button
                            type="primary"
                            icon={<DashboardOutlined />}
                            onClick={() => showReadingModal(record)}
                            size="small"
                            loading={recordReadingLoading && selectedNozzle?.id === record.id}
                            disabled={recordReadingLoading && selectedNozzle?.id === record.id}
                        />
                    </Tooltip>
                    <Tooltip title="View History">
                        <Button
                            type="default"
                            icon={<HistoryOutlined />}
                            onClick={() => fetchReadingHistory(record.id)}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="default"
                            icon={<EditOutlined />}
                            onClick={() => showModal(record)}
                            size="small"
                            disabled={!isAdmin}
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Are you sure you want to delete this nozzle?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                            okButtonProps={{ loading: deleteLoading === record.id }}
                            disabled={!isAdmin}
                        >
                            <Button
                                danger
                                icon={deleteLoading === record.id ? <LoadingOutlined /> : <DeleteOutlined />}
                                size="small"
                                disabled={deleteLoading === record.id || !isAdmin}
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <Card className="nozzle-management-container">
            <div className="nozzle-header d-flex justify-content-between flex-wrap mb-3">
                <Title level={3}>Nozzle Management</Title>
                <Space wrap>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                        disabled={!isAdmin}
                    >
                        Add Nozzle Attachment
                    </Button>
                    <Button
                        type="default"
                        icon={<FileExcelOutlined />}
                        onClick={handleExportToExcel}
                        loading={exporting}
                    >
                        Export to Excel
                    </Button>
                </Space>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8} lg={8}>
                    <Statistic
                        title="Total Sales (PKR)"
                        value={nozzles.reduce((sum, n) => sum + (n.totalSales || 0), 0)}
                        precision={2}
                        prefix="₨"
                    />
                </Col>
            </Row>

            <div className="table-responsive">
                <Table
                    columns={columns}
                    dataSource={nozzles}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, responsive: true }}
                    bordered
                    scroll={{ x: 'max-content' }}
                />
            </div>

            {/* Add/Edit Nozzle Modal */}
            <Modal
                title={editingId ? "Edit Nozzle Attachment" : "Add New Nozzle Attachment"}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                width={800}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Form.Item
                            name="dispenserId"
                            label="Dispenser"
                            rules={[{ required: true, message: 'Please select dispenser' }]}
                        >
                            <Select placeholder="Select dispenser" disabled={!isAdmin}>
                                {dispensers.map(dispenser => (
                                    <Option key={dispenser.id} value={dispenser.id}>
                                        {dispenser.dispenserName}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="productId"
                            label="Product"
                            rules={[{ required: true, message: 'Please select product' }]}
                        >
                            <Select placeholder="Select product" disabled={!isAdmin}>
                                {products.map(product => (
                                    <Option key={product.id} value={product.id}>
                                        {product.productName}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="openingReading"
                            label="Opening Reading"
                            rules={[
                                { required: true, message: 'Please enter opening reading' },
                                { type: 'number', min: 0, message: 'Reading must be a positive number' },
                            ]}
                        >
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter opening reading" />
                        </Form.Item>
                    </div>
                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleCancel}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={submitLoading} disabled={submitLoading || !isAdmin}>
                                {editingId ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Record Reading Modal */}
            <Modal
                title="Record Nozzle Reading"
                open={isReadingModalVisible}
                onCancel={handleReadingCancel}
                footer={null}
            >
                {selectedNozzle && (
                    <Form
                        form={readingForm}
                        layout="vertical"
                        onFinish={handleReadingSubmit}
                    >
                        <Form.Item name="nozzleId" hidden>
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="previousReading"
                            label="Previous Reading"
                        >
                            <InputNumber disabled={!isAdmin} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item
                            name="currentReading"
                            label="Current Reading"
                            rules={[
                                { required: true, message: 'Please enter current reading' },
                                { type: 'number', min: 0, message: 'Reading must be a positive number' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('previousReading') <= value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Current reading must be greater than previous reading'));
                                    },
                                }),
                            ]}
                        >
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter current reading" />
                        </Form.Item>
                        <Form.Item
                            name="tankId"
                            label="Select Tank"
                            rules={[{ required: true, message: 'Please select a tank' }]}
                        >
                            <Select placeholder="Select tank">
                                {tanks.map(tank => (
                                    <Option key={tank.id} value={tank.id}>
                                        {tank.tankName} (Available: {tank.openingStock || 0})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="newPrice"
                            label="New Product Price (PKR)"
                        >
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder="Enter new product price if updating"
                                formatter={value => `₨ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={value => value.replace(/₨\s?|(,*)/g, '')}
                            />
                        </Form.Item>
                        <Form.Item>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <Button onClick={handleReadingCancel}>Cancel</Button>
                                <Button type="primary" htmlType="submit" loading={recordReadingLoading} disabled={recordReadingLoading}>
                                    Record Reading
                                </Button>
                            </div>
                        </Form.Item>
                    </Form>
                )}
            </Modal>

            {/* Reading History Modal */}
            <Modal
                title="Reading History"
                open={isHistoryModalVisible}
                onCancel={handleHistoryCancel}
                footer={null}
                width={800}
            >
                <Table
                    dataSource={readingHistory}
                    columns={[
                        {
                            title: 'Date',
                            dataIndex: 'timestamp',
                            key: 'timestamp',
                            render: (timestamp) => moment(timestamp.toDate()).format('DD/MM/YYYY HH:mm:ss'),
                        },
                        {
                            title: 'Previous Reading',
                            dataIndex: 'previousReading',
                            key: 'previousReading',
                        },
                        {
                            title: 'Current Reading',
                            dataIndex: 'currentReading',
                            key: 'currentReading',
                        },
                        {
                            title: 'Sales Volume',
                            dataIndex: 'salesVolume',
                            key: 'salesVolume',
                        },
                        {
                            title: 'Sales Amount (PKR)',
                            dataIndex: 'salesAmount',
                            key: 'salesAmount',
                            render: (amount) => `₨${amount.toFixed(2)}`,
                        },
                        {
                            title: 'Tank',
                            dataIndex: 'tankId',
                            key: 'tankId',
                            render: (tankId) => {
                                const tank = tanks.find(t => t.id === tankId);
                                return tank ? tank.tankName : 'Unknown';
                            },
                        },
                    ]}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Modal>
        </Card>
    );
};

export default NozzleManagement;