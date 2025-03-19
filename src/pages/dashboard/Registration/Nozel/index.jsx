import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Select, Space, Card,
    Typography, message, Tooltip, Popconfirm, InputNumber, Statistic, Row, Col, Divider
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, AimOutlined, DashboardOutlined,
    DatabaseOutlined, HistoryOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';

const { Title } = Typography;
const { Option } = Select;

const NozzleManagement = () => {
    const [nozzles, setNozzles] = useState([]);
    const [dispensers, setDispensers] = useState([]);
    const [products, setProducts] = useState([]);
    const [tanks, setTanks] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isReadingModalVisible, setIsReadingModalVisible] = useState(false);
    const [selectedNozzle, setSelectedNozzle] = useState(null);
    const [form] = Form.useForm();
    const [readingForm] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);

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
            message.error("Failed to fetch nozzles: " + error.message);
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
            message.error("Failed to fetch dispensers: " + error.message);
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
            message.error("Failed to fetch products: " + error.message);
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
            message.error("Failed to fetch tanks: " + error.message);
        }
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue(record);
        } else {
            setEditingId(null);
            form.resetFields();
        }
        setIsModalVisible(true);
    };

    const showReadingModal = (record) => {
        setSelectedNozzle(record);
        readingForm.setFieldsValue({
            nozzleId: record.id,
            previousReading: record.lastReading || 0,
            currentReading: '',
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

    const handleSubmit = async (values) => {
        try {
            if (editingId) {
                await updateDoc(doc(db, "nozzles", editingId), values);
                message.success("Nozzle updated successfully");
            } else {
                await addDoc(collection(db, "nozzles"), {
                    ...values,
                    lastReading: 0,
                    totalSales: 0,
                });
                message.success("Nozzle created successfully");
            }
            setIsModalVisible(false);
            fetchNozzles();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        }
    };

    const handleReadingSubmit = async (values) => {
        try {
            const { currentReading, previousReading } = values;
            const salesVolume = currentReading - previousReading;

            if (salesVolume < 0) {
                message.error("Current reading cannot be less than previous reading");
                return;
            }

            // Get product price
            const product = products.find(p => p.id === selectedNozzle.productId);
            const salesAmount = salesVolume * product.salesPrice;

            // Update nozzle reading
            await updateDoc(doc(db, "nozzles", selectedNozzle.id), {
                lastReading: currentReading,
                totalSales: (selectedNozzle.totalSales || 0) + salesAmount
            });

            // Add reading record
            await addDoc(collection(db, "readings"), {
                nozzleId: selectedNozzle.id,
                dispenserId: selectedNozzle.dispenserId,
                tankId: selectedNozzle.tankId,
                productId: selectedNozzle.productId,
                previousReading,
                currentReading,
                salesVolume,
                salesAmount,
                timestamp: new Date()
            });

            message.success("Reading recorded successfully");
            setIsReadingModalVisible(false);
            fetchNozzles();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, "nozzles", id));
            message.success("Nozzle deleted successfully");
            fetchNozzles();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        }
    };

    const handleExportToExcel = () => {
        exportToExcel(nozzles, 'Nozzles');
        message.success("Exported successfully");
    };

    const columns = [
        {
            title: 'Attachment ID',
            dataIndex: 'attachmentId',
            key: 'attachmentId',
            sorter: (a, b) => a.attachmentId.localeCompare(b.attachmentId),
        },
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
            title: 'Nozzle Position',
            dataIndex: 'nozzlePosition',
            key: 'nozzlePosition',
            render: (position) => `Nozzle ${position}`,
            filters: [
                { text: 'Nozzle 1', value: '1' },
                { text: 'Nozzle 2', value: '2' },
                { text: 'Nozzle 3', value: '3' },
                { text: 'Nozzle 4', value: '4' },
            ],
            onFilter: (value, record) => record.nozzlePosition === value,
        },
        {
            title: 'Tank',
            dataIndex: 'tankId',
            key: 'tankId',
            render: (tankId) => {
                const tank = tanks.find(t => t.id === tankId);
                return tank ? tank.tankName : 'Unknown';
            },
            filters: tanks.map(t => ({ text: t.tankName, value: t.id })),
            onFilter: (value, record) => record.tankId === value,
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
            sorter: (a, b) => a.totalSales - b.totalSales,
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
                        />
                    </Tooltip>
                    <Tooltip title="View History">
                        <Button
                            type="default"
                            icon={<HistoryOutlined />}
                            onClick={() => {/* Logic to show reading history */ }}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="default"
                            icon={<EditOutlined />}
                            onClick={() => showModal(record)}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Are you sure you want to delete this nozzle?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <Card className="nozzle-management-container">
            <div className="nozzle-header">
                <Title level={3}>Nozzle Management</Title>
                <Space>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                    >
                        Add Nozzle Attachment
                    </Button>
                    <Button
                        type="default"
                        icon={<FileExcelOutlined />}
                        onClick={handleExportToExcel}
                    >
                        Export to Excel
                    </Button>
                </Space>
            </div>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                    <Statistic
                        title="Total Sales (PKR)"
                        value={nozzles.reduce((sum, n) => sum + (n.totalSales || 0), 0)}
                        precision={2}
                        prefix="₨"
                    />
                </Col>
            </Row>

            <Table
                columns={columns}
                dataSource={nozzles}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                bordered
                scroll={{ x: 'max-content' }}
            />

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
                            name="attachmentId"
                            label="Attachment ID"
                            rules={[{ required: true, message: 'Please enter attachment ID' }]}
                        >
                            <Input prefix={<AimOutlined />} placeholder="Enter attachment ID" />
                        </Form.Item>

                        <Form.Item
                            name="dispenserId"
                            label="Dispenser"
                            rules={[{ required: true, message: 'Please select dispenser' }]}
                        >
                            <Select placeholder="Select dispenser">
                                {dispensers.map(dispenser => (
                                    <Option key={dispenser.id} value={dispenser.id}>{dispenser.dispenserName}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="productId"
                            label="Product"
                            rules={[{ required: true, message: 'Please select product' }]}
                        >
                            <Select placeholder="Select product">
                                {products.map(product => (
                                    <Option key={product.id} value={product.id}>{product.productName}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="nozzlePosition"
                            label="Nozzle Position"
                            rules={[{ required: true, message: 'Please select nozzle position' }]}
                        >
                            <Select placeholder="Select nozzle position">
                                <Option value="1">Nozzle 1</Option>
                                <Option value="2">Nozzle 2</Option>
                                <Option value="3">Nozzle 3</Option>
                                <Option value="4">Nozzle 4</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="tankId"
                            label="Tank"
                            rules={[{ required: true, message: 'Please select tank' }]}
                        >
                            <Select placeholder="Select tank">
                                {tanks.map(tank => (
                                    <Option key={tank.id} value={tank.id}>{tank.tankName}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </div>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button onClick={handleCancel}>Cancel</Button>
                            <Button type="primary" htmlType="submit">
                                {editingId ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

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
                        <Form.Item
                            name="nozzleId"
                            hidden
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item
                            name="previousReading"
                            label="Previous Reading"
                        >
                            <InputNumber disabled style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item
                            name="currentReading"
                            label="Current Reading"
                            rules={[
                                { required: true, message: 'Please enter current reading' },
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
                            <InputNumber style={{ width: '100%' }} placeholder="Enter current reading" />
                        </Form.Item>

                        <Form.Item>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <Button onClick={handleReadingCancel}>Cancel</Button>
                                <Button type="primary" htmlType="submit">
                                    Record Reading
                                </Button>
                            </div>
                        </Form.Item>
                    </Form>
                )}
            </Modal>
        </Card>
    );
};

export default NozzleManagement;