import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Select, Row, Col, InputNumber, Typography, Card } from 'antd';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import moment from 'moment';
import * as XLSX from 'xlsx';

const { Title } = Typography;
const { Option } = Select;

const PurchaseReturnInvoiceManagement = () => {
    const [invoices, setInvoices] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [tanks, setTanks] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fetch data on component mount
    useEffect(() => {
        fetchInvoices();
        fetchSuppliers();
        fetchProducts();
        fetchTanks();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'purchaseReturnInvoices'));
            setInvoices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            message.error('Failed to fetch invoices: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'accounts'));
            setSuppliers(
                querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(account => account.accountType === 'supplier')
            );
        } catch (error) {
            message.error('Failed to fetch suppliers: ' + error.message);
        }
    };

    const fetchProducts = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'products'));
            setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            message.error('Failed to fetch products: ' + error.message);
        }
    };

    const fetchTanks = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'tanks'));
            setTanks(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            message.error('Failed to fetch tanks: ' + error.message);
        }
    };

    // Show modal for adding or editing an invoice
    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            // Split the stored ISO datetime into date and time parts
            const dateString = record.date ? moment(record.date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
            const timeString = record.date ? moment(record.date).format('HH:mm:ss') : moment().format('HH:mm:ss');
            form.setFieldsValue({
                supplierId: record.supplierId,
                productId: record.productId,
                tankId: record.tankId,
                quantity: record.quantity,
                unitPrice: record.unitPrice,
                date: dateString,
                time: timeString,
            });
        } else {
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({
                date: moment().format('YYYY-MM-DD'),
                time: moment().format('HH:mm:ss'),
            });
        }
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    // On submit, combine date and time inputs into a single ISO datetime string
    const handleSubmit = async (values) => {
        setSubmitting(true);
        try {
            const combinedDateTime = moment(
                values.date + ' ' + values.time,
                'YYYY-MM-DD HH:mm:ss'
            ).toISOString();
            const data = {
                ...values,
                date: combinedDateTime
            };
            delete data.time;
            if (editingId) {
                await updateDoc(doc(db, 'purchaseReturnInvoices', editingId), data);
                message.success('Purchase return invoice updated');
            } else {
                await addDoc(collection(db, 'purchaseReturnInvoices'), data);
                message.success('Purchase return invoice created');
            }
            setIsModalVisible(false);
            fetchInvoices();
        } catch (error) {
            message.error('Operation failed: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        Modal.confirm({
            title: 'Are you sure you want to delete this invoice?',
            onOk: async () => {
                try {
                    await deleteDoc(doc(db, 'purchaseReturnInvoices', id));
                    message.success('Purchase return invoice deleted');
                    fetchInvoices();
                } catch (error) {
                    message.error('Delete failed: ' + error.message);
                }
            },
        });
    };

    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(
            invoices.map(invoice => ({
                Supplier: suppliers.find(s => s.id === invoice.supplierId)?.accountName || 'Unknown',
                Date: new Date(invoice.date).toLocaleString(),
                Product: products.find(p => p.id === invoice.productId)?.productName || 'Unknown',
                Tank: tanks.find(t => t.id === invoice.tankId)?.tankName || 'Unknown',
                'Quantity (Liters)': invoice.quantity,
                'Unit Price': invoice.unitPrice,
                Amount: (invoice.quantity * invoice.unitPrice).toFixed(2)
            }))
        );
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Return Invoices');
        XLSX.writeFile(workbook, 'purchase_return_invoices.xlsx');
    };

    const columns = [
        {
            title: 'Supplier',
            dataIndex: 'supplierId',
            key: 'supplierId',
            render: (supplierId) => {
                const supplier = suppliers.find(s => s.id === supplierId);
                return supplier ? supplier.accountName : 'Unknown';
            },
        },
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            render: text => new Date(text).toLocaleString()
        },
        {
            title: 'Product',
            dataIndex: 'productId',
            key: 'productId',
            render: (productId) => {
                const product = products.find(p => p.id === productId);
                return product ? product.productName : 'Unknown';
            },
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
        {
            title: 'Quantity (Liters)',
            dataIndex: 'quantity',
            key: 'quantity'
        },
        {
            title: 'Unit Price',
            dataIndex: 'unitPrice',
            key: 'unitPrice'
        },
        {
            title: 'Amount',
            key: 'amount',
            render: (_, record) => `${(record.quantity * record.unitPrice).toFixed(2)}`
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <>
                    <Button onClick={() => showModal(record)}>Edit</Button>
                    <Button danger onClick={() => handleDelete(record.id)} style={{ marginLeft: 8 }}>
                        Delete
                    </Button>
                </>
            )
        }
    ];

    return (
        <Card >
            <Row justify="space-between" style={{ marginBottom: 16 }}>
                <Title level={2} style={{ marginBottom: '20px' }}>Purchase Return Invoices</Title>
                <div>
                    <Button type="primary" onClick={() => showModal()} style={{ marginRight: 8 }}>
                        Add Purchase Return Invoice
                    </Button>
                    <Button onClick={exportToExcel}>Export to Excel</Button>
                </div>
            </Row>
            <Table dataSource={invoices} columns={columns} rowKey="id" loading={loading} />
            <Modal
                title={editingId ? 'Edit Purchase Return Invoice' : 'Add Purchase Return Invoice'}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                <Form form={form} onFinish={handleSubmit} layout="vertical">
                    <Form.Item
                        name="supplierId"
                        label="Supplier"
                        rules={[{ required: true, message: 'Please select a supplier' }]}
                    >
                        <Select placeholder="Select a supplier">
                            {suppliers.map(supplier => (
                                <Option key={supplier.id} value={supplier.id}>
                                    {supplier.accountName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="date"
                        label="Date"
                        rules={[{ required: true, message: 'Please select a date' }]}
                    >
                        <Input type="date" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="time"
                        label="Time"
                        rules={[{ required: true, message: 'Please select a time' }]}
                    >
                        <Input type="time" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="productId"
                        label="Product"
                        rules={[{ required: true, message: 'Please select a product' }]}
                    >
                        <Select placeholder="Select product">
                            {products.map(product => (
                                <Option key={product.id} value={product.id}>
                                    {product.productName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="tankId"
                        label="Tank"
                        rules={[{ required: true, message: 'Please select a tank' }]}
                    >
                        <Select placeholder="Select tank">
                            {tanks.map(tank => (
                                <Option key={tank.id} value={tank.id}>
                                    {tank.tankName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="quantity"
                        label="Quantity (Liters)"
                        rules={[{ required: true, message: 'Please enter quantity in liters' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        name="unitPrice"
                        label="Unit Price (per liter)"
                        rules={[{ required: true, message: 'Please enter price per liter' }]}
                    >
                        <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting}>
                            {editingId ? 'Update' : 'Create'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default PurchaseReturnInvoiceManagement;
