import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, DatePicker, message } from 'antd';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';

const PurchaseReturnInvoiceManagement = () => {
    const [invoices, setInvoices] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        const querySnapshot = await getDocs(collection(db, 'purchaseReturnInvoices'));
        setInvoices(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    const showModal = (record = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue({ ...record, date: record.date ? new Date(record.date) : null });
        } else {
            setEditingId(null);
            form.resetFields();
        }
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };

    const handleSubmit = async (values) => {
        try {
            const data = { ...values, date: values.date.toISOString() };
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
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, 'purchaseReturnInvoices', id));
            message.success('Purchase return invoice deleted');
            fetchInvoices();
        } catch (error) {
            message.error('Delete failed: ' + error.message);
        }
    };

    const columns = [
        { title: 'Return ID', dataIndex: 'returnId', key: 'returnId' },
        { title: 'Supplier ID', dataIndex: 'supplierId', key: 'supplierId' },
        { title: 'Date', dataIndex: 'date', key: 'date', render: text => new Date(text).toLocaleDateString() },
        { title: 'Amount', dataIndex: 'amount', key: 'amount' },
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
            ),
        },
    ];

    return (
        <div>
            <Button type="primary" onClick={() => showModal()} style={{ marginBottom: 16 }}>
                Add Purchase Return Invoice
            </Button>
            <Table dataSource={invoices} columns={columns} rowKey="id" />
            <Modal
                title={editingId ? 'Edit Purchase Return Invoice' : 'Add Purchase Return Invoice'}
                open={isModalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                <Form form={form} onFinish={handleSubmit}>
                    <Form.Item name="returnId" label="Return ID" rules={[{ required: true, message: 'Please enter Return ID' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="supplierId" label="Supplier ID" rules={[{ required: true, message: 'Please enter Supplier ID' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select a date' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="amount" label="Amount" rules={[{ required: true, message: 'Please enter amount' }]}>
                        <Input type="number" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            {editingId ? 'Update' : 'Create'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PurchaseReturnInvoiceManagement;