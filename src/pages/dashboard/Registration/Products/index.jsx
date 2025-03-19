import React, { useState, useEffect } from 'react';
import {
    Table, Button, Modal, Form, Input, Select, Space, Card,
    Typography, message, Tooltip, Popconfirm, InputNumber,
    Statistic, Row, Col, Divider, DatePicker
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    FileExcelOutlined, SearchOutlined, HistoryOutlined
} from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { exportToExcel } from '../../../../services/exportService';
import { useAuth } from '../../../../context/AuthContext';
import moment from 'moment';

const { Title } = Typography;
const { Option } = Select;

const ProductManagement = () => {
    const [products, setProducts] = useState([]);
    const [tanks, setTanks] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isPriceHistoryModalVisible, setIsPriceHistoryModalVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    const { isAdmin } = useAuth();

    useEffect(() => {
        fetchProducts();
        fetchTanks();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            const productList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProducts(productList);
        } catch (error) {
            message.error("Failed to fetch products: " + error.message);
        } finally {
            setLoading(false);
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

    const showPriceHistoryModal = (record) => {
        setSelectedProduct(record);
        setIsPriceHistoryModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handlePriceHistoryCancel = () => {
        setIsPriceHistoryModalVisible(false);
    };

    const handleSubmit = async (values) => {
        setSubmitLoading(true);
        try {
            if (editingId) {
                const existingProduct = products.find(p => p.id === editingId);
                const newPriceHistory = existingProduct.priceHistory || [];

                // Only record price history if sales price has changed
                if (existingProduct.salesPrice !== values.salesPrice) {
                    newPriceHistory.push({
                        price: values.salesPrice,
                        date: new Date().toISOString(),
                        previousPrice: existingProduct.salesPrice
                    });
                }
                values.priceHistory = newPriceHistory;

                await updateDoc(doc(db, "products", editingId), values);
                message.success("Product updated successfully");
            } else {
                // Initialize empty price history for new products
                values.priceHistory = [{
                    price: values.salesPrice,
                    date: new Date().toISOString(),
                    previousPrice: null
                }];
                await addDoc(collection(db, "products"), values);
                message.success("Product created successfully");
            }
            setIsModalVisible(false);
            fetchProducts();
        } catch (error) {
            message.error("Operation failed: " + error.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setDeleteLoading(id);
        try {
            await deleteDoc(doc(db, "products", id));
            message.success("Product deleted successfully");
            fetchProducts();
        } catch (error) {
            message.error("Delete failed: " + error.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleExportToExcel = () => {
        setExportLoading(true);
        try {
            exportToExcel(products, 'Products');
            message.success("Exported successfully");
        } catch (error) {
            message.error("Export failed: " + error.message);
        } finally {
            setExportLoading(false);
        }
    };

    const priceHistoryColumns = [
        {
            title: 'Date & Time',
            dataIndex: 'date',
            key: 'date',
            render: (date) => moment(date).format('DD/MM/YYYY HH:mm:ss'),
        },
        {
            title: 'Previous Price (PKR)',
            dataIndex: 'previousPrice',
            key: 'previousPrice',
            render: (price) => price ? `₨${parseFloat(price).toFixed(2)}` : 'Initial Price',
        },
        {
            title: 'New Price (PKR)',
            dataIndex: 'price',
            key: 'price',
            render: (price) => `₨${parseFloat(price).toFixed(2)}`,
        },
        {
            title: 'Change',
            key: 'change',
            render: (_, record) => {
                if (!record.previousPrice) return 'N/A';

                const change = parseFloat(record.price) - parseFloat(record.previousPrice);
                const percentChange = (change / parseFloat(record.previousPrice)) * 100;

                const color = change > 0 ? '#ff4d4f' : '#52c41a';
                const prefix = change > 0 ? '+' : '';

                return <span style={{ color }}>
                    {`${prefix}${change.toFixed(2)} (${prefix}${percentChange.toFixed(2)}%)`}
                </span>;
            }
        }
    ];

    const columns = [
        {
            title: 'Product ID',
            dataIndex: 'productId',
            key: 'productId',
            sorter: (a, b) => a.productId.localeCompare(b.productId),
        },
        {
            title: 'Product Name',
            dataIndex: 'productName',
            key: 'productName',
            sorter: (a, b) => a.productName.localeCompare(b.productName),
        },
        {
            title: 'Brand',
            dataIndex: 'brand',
            key: 'brand',
        },
        {
            title: 'Store',
            dataIndex: 'store',
            key: 'store',
            render: (storeId) => {
                const tank = tanks.find(tank => tank.id === storeId);
                return tank ? tank.tankName : 'Unknown';
            }
        },
        {
            title: 'Purchase Price (PKR)',
            dataIndex: 'purchasePrice',
            key: 'purchasePrice',
            render: (price) => `₨${price?.toFixed(2)}`,
            sorter: (a, b) => a.purchasePrice - b.purchasePrice,
        },
        {
            title: 'Sales Price (PKR)',
            dataIndex: 'salesPrice',
            key: 'salesPrice',
            render: (price) => `₨${price?.toFixed(2)}`,
            sorter: (a, b) => a.salesPrice - b.salesPrice,
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Price History">
                        <Button
                            type="default"
                            icon={<HistoryOutlined />}
                            onClick={() => showPriceHistoryModal(record)}
                            size="small"
                            disabled={!record.priceHistory || record.priceHistory.length === 0}
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={() => showModal(record)}
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Are you sure you want to delete this product?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                            okButtonProps={{ loading: deleteLoading === record.id }}
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                                loading={deleteLoading === record.id}
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const filteredProducts = products.filter(product =>
        product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.productId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get total product value
    const calculateTotalValue = () => {
        return products.reduce((sum, product) => {
            return sum + (product.salesPrice * (product.openingQuantity || 0));
        }, 0);
    };

    return (
        <Card className="product-management-container">
            <div className="product-header d-flex justify-content-between flex-wrap mb-3">
                <Title level={3}>Product Management</Title>
                <Space wrap>
                    <Input
                        placeholder="Search by name, ID or brand"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: 300 }}
                        prefix={<SearchOutlined />}
                        allowClear
                    />
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => showModal()}
                    >
                        Add Product
                    </Button>
                    <Button
                        type="default"
                        icon={<FileExcelOutlined />}
                        onClick={handleExportToExcel}
                        loading={exportLoading}
                    >
                        Export to Excel
                    </Button>
                </Space>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8} lg={8}>
                    <Statistic
                        title="Total Products"
                        value={products.length}
                    />
                </Col>
                <Col xs={24} sm={12} md={8} lg={8}>
                    <Statistic
                        title="Total Inventory Value (PKR)"
                        value={calculateTotalValue()}
                        precision={2}
                        prefix="₨"
                    />
                </Col>
            </Row>

            <div className="table-responsive">
                <Table
                    columns={columns}
                    dataSource={filteredProducts}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, responsive: true }}
                    bordered
                    scroll={{ x: 'max-content' }}
                />
            </div>

            {/* Add/Edit Product Modal */}
            <Modal
                title={editingId ? "Edit Product" : "Add New Product"}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
                width="90%"
                style={{ maxWidth: '800px' }}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <div className="form-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '16px'
                    }}>
                        <Form.Item
                            name="productId"
                            label="Product ID"
                            rules={[{ required: true, message: 'Please enter product ID' }]}
                        >
                            <Input placeholder="Enter product ID" />
                        </Form.Item>

                        <Form.Item
                            name="productName"
                            label="Product Name"
                            rules={[{ required: true, message: 'Please enter product name' }]}
                        >
                            <Input placeholder="Enter product name" />
                        </Form.Item>

                        <Form.Item
                            name="openingQuantity"
                            label="Opening Quantity"
                            rules={[{ required: true, message: 'Please enter opening quantity' }]}
                        >
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder="Enter opening quantity"
                            />
                        </Form.Item>

                        <Form.Item
                            name="store"
                            label="Store (Tank)"
                            rules={[{ required: true, message: 'Please select store' }]}
                        >
                            <Select placeholder="Select tank">
                                {tanks.map(tank => (
                                    <Option key={tank.id} value={tank.id}>{tank.tankName}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="brand"
                            label="Brand"
                        >
                            <Input placeholder="Enter brand" />
                        </Form.Item>

                        <Form.Item
                            name="category"
                            label="Category"
                        >
                            <Input placeholder="Enter category" />
                        </Form.Item>

                        <Form.Item
                            name="purchasePrice"
                            label="Purchase Price (PKR)"
                            rules={[{ required: true, message: 'Please enter purchase price' }]}
                        >
                            <InputNumber
                                min={0}
                                step={0.01}
                                style={{ width: '100%' }}
                                placeholder="Enter purchase price"
                                formatter={value => `₨ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={value => value.replace(/₨\s?|(,*)/g, '')}
                            />
                        </Form.Item>

                        <Form.Item
                            name="salesPrice"
                            label="Sales Price (PKR)"
                            rules={[{ required: true, message: 'Please enter sales price' }]}
                        >
                            <InputNumber
                                min={0}
                                step={0.01}
                                style={{ width: '100%' }}
                                placeholder="Enter sales price"
                                formatter={value => `₨ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={value => value.replace(/₨\s?|(,*)/g, '')}
                            />
                        </Form.Item>

                        <Form.Item
                            name="priceHistory"
                            label="Price History"
                            hidden
                        >
                            <Input />
                        </Form.Item>
                    </div>

                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                            <Button onClick={handleCancel}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={submitLoading}>
                                {editingId ? 'Update' : 'Create'}
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Price History Modal */}
            <Modal
                title={`Price History - ${selectedProduct?.productName || ''}`}
                open={isPriceHistoryModalVisible}
                onCancel={handlePriceHistoryCancel}
                footer={[
                    <Button key="close" onClick={handlePriceHistoryCancel}>
                        Close
                    </Button>
                ]}
                width="90%"
                style={{ maxWidth: '800px' }}
                destroyOnClose
            >
                {selectedProduct && selectedProduct.priceHistory && (
                    <Table
                        columns={priceHistoryColumns}
                        dataSource={[...selectedProduct.priceHistory].reverse()} // Show newest first
                        rowKey={(record, index) => index}
                        pagination={{ pageSize: 10 }}
                        bordered
                        scroll={{ x: 'max-content' }}
                    />
                )}
            </Modal>
        </Card>
    );
};

export default ProductManagement;