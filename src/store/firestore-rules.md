rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper Functions
    function isSignedIn() { return request.auth != null; }
    
    function userRole() {
      return isSignedIn()
        ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
        : null;
    }
    
    function isAdmin() { return userRole() == 'admin'; }
    function isEmployee() { return userRole() == 'employee'; }
    function isCustomer() { return userRole() == 'customer'; }

    // Users Collection (RBAC Roles)
    match /users/{uid} {
      // Admin can read all, Users can read themselves
      allow read: if isSignedIn() && (request.auth.uid == uid || isAdmin());
      
      // Admin can write anything
      // Employee can ONLY create NEW documents with role 'customer'
      allow write: if isSignedIn() && (
        request.auth.uid == uid || 
        isAdmin() ||
        (isEmployee() && resource == null && request.resource.data.role == 'customer')
      );
    }

    // Customers Data (Profile Details)
    match /customers/{customerId} {
      // Admin/Employee can read all
      // Customer can only read their own profile
      allow read: if isSignedIn() && (
        isAdmin() || isEmployee() || (isCustomer() && request.auth.uid == customerId)
      );
      
      // Only Admin/Employee can manage customer profiles
      allow write: if isSignedIn() && ( isAdmin() || isEmployee() );
    }

    // Transactions
    match /transactions/{txId} {
      // Admin/Employee can read all
      // Customer can only read their own transactions
      allow read: if isSignedIn() && (
        isAdmin() || isEmployee() || (isCustomer() && resource.data.customerId == request.auth.uid)
      );
      
      // Only Admin/Employee can create/manage transactions
      allow create, update, delete: if isSignedIn() && ( isAdmin() || isEmployee() );
    }

    // Proofs (Uploads)
    match /proofs/{docId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && ( isAdmin() || isEmployee() );
    }
  }
}
