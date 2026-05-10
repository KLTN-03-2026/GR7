import React, { useState, useEffect } from 'react';
import {
    FaUserPlus,
    FaEdit,
    FaSearch,
    FaRegStopCircle,
    FaCheckCircle,
    FaTrashAlt,
    FaTrashRestore,
    FaExclamationTriangle,
} from 'react-icons/fa';
import Axios from '@/utils/Axios';
import SummaryApi from '@/common/SummaryApi';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';

const EmployeeManagementPage = () => {
    const user = useSelector((state) => state?.user);

    // Tabs state
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'deleted'

    // Data states
    const [users, setUsers] = useState([]);
    const [deletedUsers, setDeletedUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modals state
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState({
        show: false,
        action: '',
        user: null,
    });

    // Form data
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        email: '',
        password: '',
        role: 'CUSTOMER',
        status: 'Active',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const rolesList = [
        'ADMIN',
        'MANAGER',
        'CHEF',
        'WAITER',
        'CASHIER',
        'CUSTOMER',
    ];

    const fetchActiveUsers = async () => {
        try {
            setLoading(true);
            const response = await Axios({
                ...SummaryApi.get_admin_users,
            });

            if (response.data.success) {
                setUsers(response.data.data);
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    'Lỗi khi tải danh sách người dùng'
            );
        } finally {
            setLoading(false);
        }
    };

    const fetchDeletedUsers = async () => {
        try {
            setLoading(true);
            const response = await Axios({
                ...SummaryApi.get_deleted_admin_users,
            });

            if (response.data.success) {
                setDeletedUsers(response.data.data);
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    'Lỗi khi tải danh sách người dùng đã xóa'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'active') {
            fetchActiveUsers();
        } else {
            fetchDeletedUsers();
        }
    }, [activeTab]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleOpenAdd = () => {
        setFormData({
            id: '',
            name: '',
            email: '',
            password: '',
            role: 'WAITER',
            status: 'Active',
        });
        setShowAddModal(true);
    };

    const handleOpenEdit = (userToEdit) => {
        setFormData({
            id: userToEdit._id,
            name: userToEdit.name,
            email: userToEdit.email,
            password: '',
            role: userToEdit.role,
            status: userToEdit.status,
        });
        setShowEditModal(true);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const response = await Axios({
                ...SummaryApi.create_admin_user,
                data: {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                },
            });

            if (response.data.success) {
                toast.success(response.data.message);
                setShowAddModal(false);
                fetchActiveUsers();
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message || 'Có lỗi xảy ra khi tạo'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const response = await Axios({
                ...SummaryApi.update_admin_user,
                url: SummaryApi.update_admin_user.url + '/' + formData.id,
                data: {
                    name: formData.name,
                    role: formData.role,
                    status: formData.status,
                },
            });

            if (response.data.success) {
                toast.success(response.data.message);
                setShowEditModal(false);
                fetchActiveUsers();
            }
        } catch (error) {
            toast.error(
                error.response?.data?.message || 'Trục trặc khi cập nhật'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleActionConfirm = async () => {
        const { action, user: targetUser } = showConfirmModal;
        try {
            setIsSubmitting(true);
            let response;

            if (action === 'soft_delete') {
                response = await Axios({
                    ...SummaryApi.soft_delete_admin_user,
                    url:
                        SummaryApi.soft_delete_admin_user.url +
                        '/' +
                        targetUser._id,
                });
            } else if (action === 'restore') {
                response = await Axios({
                    ...SummaryApi.restore_admin_user,
                    url:
                        SummaryApi.restore_admin_user.url +
                        '/' +
                        targetUser._id,
                });
            } else if (action === 'hard_delete') {
                response = await Axios({
                    ...SummaryApi.hard_delete_admin_user,
                    url:
                        SummaryApi.hard_delete_admin_user.url +
                        '/' +
                        targetUser._id,
                });
            }

            if (response.data.success) {
                toast.success(response.data.message);
                setShowConfirmModal({ show: false, action: '', user: null });
                if (activeTab === 'active') fetchActiveUsers();
                if (activeTab === 'deleted') fetchDeletedUsers();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Thao tác thất bại');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openConfirmModal = (action, u) => {
        setShowConfirmModal({ show: true, action, user: u });
    };

    const dataToDisplay = activeTab === 'active' ? users : deletedUsers;
    const filteredUsers = dataToDisplay.filter(
        (u) =>
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="container mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-highlight uppercase flex items-center gap-2">
                        Quản lý Tài khoản Hệ thống
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Thêm mới, sửa quyền hạn hoặc quản lý thùng rác.
                    </p>
                </div>
                {user.role === 'ADMIN' && activeTab === 'active' && (
                    <button
                        onClick={handleOpenAdd}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition"
                    >
                        <FaUserPlus /> Thêm tài khoản
                    </button>
                )}
            </div>

            {/* Tabs & Filter */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between liquid-glass border border-white/10 rounded-lg p-4">
                <div className="flex w-full md:w-auto overflow-x-auto gap-2">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-2 text-sm font-medium transition-all ${
                            activeTab === 'active'
                                ? 'border-b-2 border-highlight text-highlight'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Đang Hoạt Động (
                        {activeTab === 'active' ? users.length : '...'})
                    </button>
                    <button
                        onClick={() => setActiveTab('deleted')}
                        className={`px-4 py-2 text-sm font-medium transition-all ${
                            activeTab === 'deleted'
                                ? 'border-b-2 border-red-500 text-red-500'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Đã Xóa / Khóa (
                        {activeTab === 'deleted' ? deletedUsers.length : '...'})
                    </button>
                </div>

                <div className="relative w-full md:w-64">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Tìm theo tên/email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-background border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:border-highlight"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="liquid-glass rounded-lg border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-foreground">
                        <thead className="text-xs uppercase bg-black/40 text-highlight border-b border-gray-800">
                            <tr>
                                <th className="px-6 py-4">STT</th>
                                <th className="px-6 py-4">Người dùng</th>
                                <th className="px-6 py-4">Vai trò</th>
                                <th className="px-6 py-4">Trạng thái</th>
                                <th className="px-6 py-4">
                                    {activeTab === 'active'
                                        ? 'Ngày tham gia'
                                        : 'Ngày Xóa'}
                                </th>
                                <th className="px-6 py-4 text-center">
                                    Thao tác
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan="6"
                                        className="text-center py-8 text-muted-foreground"
                                    >
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="6"
                                        className="text-center py-8 text-muted-foreground"
                                    >
                                        Không tìm thấy tài khoản nào.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u, index) => (
                                    <tr
                                        key={u._id}
                                        className="border-b border-gray-800 last:border-0 hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4 font-medium">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold">
                                                {u.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {u.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold">
                                            {u.role === 'ADMIN' ? (
                                                <span className="text-red-400">
                                                    {u.role}
                                                </span>
                                            ) : u.role === 'MANAGER' ? (
                                                <span className="text-orange-400">
                                                    {u.role}
                                                </span>
                                            ) : (
                                                <span className="text-blue-400">
                                                    {u.role}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {u.status === 'Active' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                                    <FaCheckCircle className="text-[10px]" />{' '}
                                                    Hoạt động
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                    <FaRegStopCircle className="text-[10px]" />{' '}
                                                    Khóa
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-muted-foreground">
                                            {activeTab === 'active'
                                                ? format(
                                                      new Date(u.createdAt),
                                                      'dd/MM/yyyy HH:mm'
                                                  )
                                                : u.deletedAt
                                                  ? format(
                                                        new Date(u.deletedAt),
                                                        'dd/MM/yyyy HH:mm'
                                                    )
                                                  : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                {activeTab === 'active' ? (
                                                    <>
                                                        <button
                                                            onClick={() =>
                                                                handleOpenEdit(
                                                                    u
                                                                )
                                                            }
                                                            className="text-highlight hover:text-highlight/80 transition-colors"
                                                            title="Sửa"
                                                        >
                                                            <FaEdit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                openConfirmModal(
                                                                    'soft_delete',
                                                                    u
                                                                )
                                                            }
                                                            className="text-red-400 hover:text-red-300 transition-colors"
                                                            title="Đưa vào thùng rác"
                                                        >
                                                            <FaTrashAlt
                                                                size={16}
                                                            />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() =>
                                                                openConfirmModal(
                                                                    'restore',
                                                                    u
                                                                )
                                                            }
                                                            className="text-green-400 hover:text-green-300 transition-colors"
                                                            title="Khôi phục"
                                                        >
                                                            <FaTrashRestore
                                                                size={16}
                                                            />
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                openConfirmModal(
                                                                    'hard_delete',
                                                                    u
                                                                )
                                                            }
                                                            className="text-red-500 hover:text-red-400 transition-colors"
                                                            title="Xóa vĩnh viễn"
                                                        >
                                                            <FaTrashAlt
                                                                size={16}
                                                            />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Add */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-background border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
                        <h3 className="text-xl font-bold text-highlight mb-4">
                            Tạo Tài Khoản Mới
                        </h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Tên hiển thị{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 text-sm outline-none focus:border-highlight"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Email{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 text-sm outline-none focus:border-highlight"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Mật khẩu{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    minLength={6}
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 text-sm outline-none focus:border-highlight"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Vai trò
                                </label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 text-sm outline-none focus:border-highlight"
                                >
                                    {rolesList.map((r) => (
                                        <option key={r} value={r}>
                                            {r}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 font-medium"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-black font-semibold disabled:opacity-50"
                                >
                                    Tạo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Edit */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-background border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
                        <h3 className="text-xl font-bold text-highlight mb-4">
                            Cập Nhật Thông Tin
                        </h3>
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Tên hiển thị{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Vai trò
                                </label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 text-sm"
                                >
                                    {rolesList.map((r) => (
                                        <option key={r} value={r}>
                                            {r}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Trạng thái
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2.5 text-sm"
                                >
                                    <option value="Active">
                                        Hoạt động (Active)
                                    </option>
                                    <option value="Inactive">
                                        Khóa (Inactive)
                                    </option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 font-medium"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-black font-semibold disabled:opacity-50"
                                >
                                    Lưu
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Danger Modal */}
            {showConfirmModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-background border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
                        <div className="mx-auto w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4">
                            <FaExclamationTriangle size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-2">
                            {showConfirmModal.action === 'soft_delete'
                                ? 'Đưa vào Thùng rác?'
                                : showConfirmModal.action === 'restore'
                                  ? 'Khôi phục tài khoản?'
                                  : 'XÓA VĨNH VIỄN?'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            {showConfirmModal.action === 'soft_delete'
                                ? `Bạn có chắc muốn xóa mềm tài khoản ${showConfirmModal.user?.name}? (Tài khoản này sẽ bị đẩy vào thùng rác và không thể đăng nhập)`
                                : showConfirmModal.action === 'restore'
                                  ? `Tài khoản ${showConfirmModal.user?.name} sẽ được kích hoạt lại.`
                                  : `Hành động này KHÔNG THỂ HOÀN TÁC. Tài khoản ${showConfirmModal.user?.name} sẽ biến mất khỏi hệ thống hoàn toàn.`}
                        </p>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() =>
                                    setShowConfirmModal({
                                        show: false,
                                        action: '',
                                        user: null,
                                    })
                                }
                                className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 font-medium transition"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleActionConfirm}
                                disabled={isSubmitting}
                                className={`flex-1 py-2 rounded-lg font-semibold transition disabled:opacity-50 ${
                                    showConfirmModal.action === 'restore'
                                        ? 'bg-green-500 hover:bg-green-600 text-white'
                                        : 'bg-red-500 hover:bg-red-600 text-white'
                                }`}
                            >
                                {isSubmitting ? 'Chờ...' : 'Xác nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeManagementPage;
