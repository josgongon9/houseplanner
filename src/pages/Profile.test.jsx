import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profile from '../pages/Profile';
import * as StoreContext from '../context/StoreContext';
import * as Firebase from '../lib/firebase';

// Mock Modules
vi.mock('../context/StoreContext', () => ({
    useStore: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
    db: {},
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(),
    doc: vi.fn(),
    updateDoc: vi.fn(),
    documentId: vi.fn(() => 'documentId')
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));

describe('Profile Component', () => {
    const mockUser = {
        uid: 'user1',
        displayName: 'Jose',
        email: 'jose@test.com',
        photoURL: null
    };

    const mockHouseholds = [
        { id: 'house1', name: 'Hogar Test', code: 'ABCDEF', members: ['user1', 'user2'] }
    ];

    const mockHomeMembers = [
        { uid: 'user1', displayName: 'Jose' },
        { uid: 'user2', displayName: 'Maria' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders user information', () => {
        StoreContext.useStore.mockReturnValue({
            user: mockUser,
            household: mockHouseholds[0],
            switchHousehold: vi.fn(),
            leaveHousehold: vi.fn(),
            removeMember: vi.fn(),
            logout: vi.fn(),
            createHousehold: vi.fn(),
            joinHousehold: vi.fn()
        });

        Firebase.getDocs.mockResolvedValue({
            docs: mockHouseholds.map(h => ({ id: h.id, data: () => h }))
        });

        render(<Profile />);

        expect(screen.getByText('Jose')).toBeInTheDocument();
        expect(screen.getByText('jose@test.com')).toBeInTheDocument();
    });

    it('expands household to show members', async () => {
        StoreContext.useStore.mockReturnValue({
            user: mockUser,
            household: mockHouseholds[0],
            switchHousehold: vi.fn()
        });

        // Mock households list
        Firebase.getDocs.mockResolvedValueOnce({
            docs: mockHouseholds.map(h => ({ id: h.id, data: () => h }))
        });

        // Mock members list fetch
        Firebase.getDocs.mockResolvedValueOnce({
            docs: mockHomeMembers.map(m => ({ id: m.uid, data: () => m }))
        });

        render(<Profile />);

        // Wait for homes to load
        await waitFor(() => expect(screen.getByText('Hogar Test')).toBeInTheDocument());

        // Click on "+" button to expand
        const expandBtn = screen.getByTitle('Ver miembros');
        fireEvent.click(expandBtn);

        // Check if members are displayed
        await waitFor(() => {
            expect(screen.getByText('Maria')).toBeInTheDocument();
            expect(screen.getByText(/Jose \(Tú\)/i)).toBeInTheDocument();
        });
    });

    it('allows removing a member from the household', async () => {
        const mockRemoveMember = vi.fn();
        StoreContext.useStore.mockReturnValue({
            user: mockUser,
            household: mockHouseholds[0],
            removeMember: mockRemoveMember
        });

        Firebase.getDocs.mockResolvedValueOnce({
            docs: mockHouseholds.map(h => ({ id: h.id, data: () => h }))
        });

        Firebase.getDocs.mockResolvedValueOnce({
            docs: mockHomeMembers.map(m => ({ id: m.uid, data: () => m }))
        });

        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

        render(<Profile />);

        await waitFor(() => expect(screen.getByText('Hogar Test')).toBeInTheDocument());
        fireEvent.click(screen.getByTitle('Ver miembros'));

        await waitFor(() => expect(screen.getByText('Maria')).toBeInTheDocument());

        // Find remove button for Maria (the second UserMinus icon button)
        const removeBtns = screen.getAllByTitle(/Eliminar del hogar/i);
        fireEvent.click(removeBtns[0]); // Maria is first in the members list after filtering? No, Maria is user2. 

        expect(confirmSpy).toHaveBeenCalledWith('¿Eliminar a Maria de este hogar?');
        expect(mockRemoveMember).toHaveBeenCalledWith('house1', 'user2');

        confirmSpy.mockRestore();
    });

    it('allows a user to remove themselves (leave) from the household', async () => {
        const mockRemoveMember = vi.fn();
        StoreContext.useStore.mockReturnValue({
            user: mockUser,
            household: mockHouseholds[0],
            removeMember: mockRemoveMember
        });

        Firebase.getDocs.mockResolvedValueOnce({
            docs: mockHouseholds.map(h => ({ id: h.id, data: () => h }))
        });

        Firebase.getDocs.mockResolvedValueOnce({
            docs: mockHomeMembers.map(m => ({ id: m.uid, data: () => m }))
        });

        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

        render(<Profile />);

        await waitFor(() => expect(screen.getByText('Hogar Test')).toBeInTheDocument());
        fireEvent.click(screen.getByTitle('Ver miembros'));

        await waitFor(() => expect(screen.getByText(/Jose \(Tú\)/i)).toBeInTheDocument());

        // Find remove button for Jose (the first UserMinus icon button)
        const removeBtns = screen.getAllByTitle(/Salir del hogar/i);
        fireEvent.click(removeBtns[0]);

        expect(confirmSpy).toHaveBeenCalledWith('¿Estás seguro de que quieres salir del hogar?');
        expect(mockRemoveMember).toHaveBeenCalledWith('house1', 'user1');

        confirmSpy.mockRestore();
    });
});
