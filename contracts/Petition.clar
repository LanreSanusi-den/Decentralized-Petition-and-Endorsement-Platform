(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-TITLE u101)
(define-constant ERR-INVALID-DESCRIPTION u102)
(define-constant ERR-INVALID-THRESHOLD u103)
(define-constant ERR-INVALID-DEADLINE u104)
(define-constant ERR-PETITION-ALREADY-EXISTS u105)
(define-constant ERR-PETITION-NOT-FOUND u106)
(define-constant ERR-INVALID-SIGNATURE u107)
(define-constant ERR-ALREADY-SIGNED u108)
(define-constant ERR-DEADLINE-PASSED u109)
(define-constant ERR-INVALID-NONCE u110)
(define-constant ERR-SIGNATURE-REPLAY u111)
(define-constant ERR-THRESHOLD-NOT-MET u112)
(define-constant ERR-INVALID-PETITION-TYPE u113)
(define-constant ERR-MAX-PETITIONS-EXCEEDED u114)
(define-constant ERR-INVALID-CATEGORY u115)
(define-constant ERR-INVALID-LOCATION u116)
(define-constant ERR-INVALID-CURRENCY u117)
(define-constant ERR-INVALID-MIN-SUPPORT u118)
(define-constant ERR-INVALID-MAX-SUPPORT u119)

(define-data-var next-petition-id uint u0)
(define-data-var max-petitions uint u500)
(define-data-var creation-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map petitions
  uint
  {
    title: (string-ascii 128),
    description: (string-ascii 512),
    threshold: uint,
    deadline: uint,
    timestamp: uint,
    creator: principal,
    petition-type: (string-ascii 32),
    category: (string-ascii 64),
    location: (string-ascii 128),
    currency: (string-ascii 8),
    status: bool,
    min-support: uint,
    max-support: uint
  }
)

(define-map petitions-by-title
  (string-ascii 128)
  uint
)

(define-map signatures
  { petition-id: uint, signer: principal }
  {
    signature: (buff 65),
    nonce: uint,
    timestamp: uint,
    verified: bool
  }
)

(define-map petition-signatures-count
  uint
  uint
)

(define-map petition-updates
  uint
  {
    update-title: (string-ascii 128),
    update-threshold: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-petition (id uint))
  (map-get? petitions id)
)

(define-read-only (get-signatures-count (id uint))
  (default-to u0 (map-get? petition-signatures-count id))
)

(define-read-only (get-signature (petition-id uint) (signer principal))
  (map-get? signatures { petition-id: petition-id, signer: signer })
)

(define-read-only (is-petition-registered (title (string-ascii 128)))
  (is-some (map-get? petitions-by-title title))
)

(define-read-only (has-signed (petition-id uint) (signer principal))
  (is-some (map-get? signatures { petition-id: petition-id, signer: signer }))
)

(define-private (validate-title (title (string-ascii 128)))
  (if (and (> (len title) u0) (<= (len title) u128))
      (ok true)
      (err ERR-INVALID-TITLE))
)

(define-private (validate-description (desc (string-ascii 512)))
  (if (and (> (len desc) u0) (<= (len desc) u512))
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-threshold (thresh uint))
  (if (and (> thresh u0) (<= thresh u1000000))
      (ok true)
      (err ERR-INVALID-THRESHOLD))
)

(define-private (validate-deadline (dl uint))
  (if (> dl block-height)
      (ok true)
      (err ERR-INVALID-DEADLINE))
)

(define-private (validate-petition-type (ptype (string-ascii 32)))
  (if (or (is-eq ptype "petition") (is-eq ptype "endorsement") (is-eq ptype "proposal"))
      (ok true)
      (err ERR-INVALID-PETITION-TYPE))
)

(define-private (validate-category (cat (string-ascii 64)))
  (if (and (> (len cat) u0) (<= (len cat) u64))
      (ok true)
      (err ERR-INVALID-CATEGORY))
)

(define-private (validate-location (loc (string-ascii 128)))
  (if (and (> (len loc) u0) (<= (len loc) u128))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-ascii 8)))
  (if (or (is-eq cur "STX") (is-eq cur "BTC") (is-eq cur "USD"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-support (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-SUPPORT))
)

(define-private (validate-max-support (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-SUPPORT))
)

(define-private (validate-signature (sig (buff 65)) (nonce uint) (ts uint))
  (if (and (> (len sig) u0) (<= (len sig) u65) (> nonce u0) (>= ts block-height))
      (ok true)
      (err ERR-INVALID-SIGNATURE))
)

(define-private (is-valid-nonce (expected-nonce uint) (provided-nonce uint))
  (if (is-eq expected-nonce provided-nonce)
      (ok true)
      (err ERR-INVALID-NONCE))
)

(define-private (prevent-replay (petition-id uint) (signer principal) (ts uint))
  (let ((existing-sig (map-get? signatures { petition-id: petition-id, signer: signer })))
    (match existing-sig
      sig-exists
        (if (> ts (get timestamp sig-exists))
            (ok true)
            (err ERR-SIGNATURE-REPLAY))
      (ok true)
    )
  )
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (asserts! (not (is-eq contract-principal 'SP000000000000000000002Q6VF78)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (var-get authority-contract)) (err u500))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-petitions (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-THRESHOLD))
    (asserts! (is-some (var-get authority-contract)) (err u501))
    (var-set max-petitions new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-THRESHOLD))
    (asserts! (is-some (var-get authority-contract)) (err u501))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (create-petition
  (title (string-ascii 128))
  (description (string-ascii 512))
  (threshold uint)
  (deadline uint)
  (petition-type (string-ascii 32))
  (category (string-ascii 64))
  (location (string-ascii 128))
  (currency (string-ascii 8))
  (min-support uint)
  (max-support uint)
)
  (let (
        (next-id (var-get next-petition-id))
        (current-max (var-get max-petitions))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-PETITIONS-EXCEEDED))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (validate-threshold threshold))
    (try! (validate-deadline deadline))
    (try! (validate-petition-type petition-type))
    (try! (validate-category category))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-min-support min-support))
    (try! (validate-max-support max-support))
    (asserts! (not (is-petition-registered title)) (err ERR-PETITION-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err u501))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set petitions next-id
      {
        title: title,
        description: description,
        threshold: threshold,
        deadline: deadline,
        timestamp: block-height,
        creator: tx-sender,
        petition-type: petition-type,
        category: category,
        location: location,
        currency: currency,
        status: true,
        min-support: min-support,
        max-support: max-support
      }
    )
    (map-set petitions-by-title title next-id)
    (map-set petition-signatures-count next-id u0)
    (var-set next-petition-id (+ next-id u1))
    (print { event: "petition-created", id: next-id })
    (ok next-id)
  )
)

(define-public (add-signature (petition-id uint) (signature (buff 65)) (nonce uint) (timestamp uint))
  (let (
        (petition (map-get? petitions petition-id))
        (current-count (get-signatures-count petition-id))
      )
    (match petition
      p
        (begin
          (asserts! (get status p) (err ERR-PETITION-NOT-FOUND))
          (asserts! (<= block-height (get deadline p)) (err ERR-DEADLINE-PASSED))
          (asserts! (not (has-signed petition-id tx-sender)) (err ERR-ALREADY-SIGNED))
          (try! (validate-signature signature nonce timestamp))
          (try! (prevent-replay petition-id tx-sender timestamp))
          (map-set signatures { petition-id: petition-id, signer: tx-sender }
            {
              signature: signature,
              nonce: nonce,
              timestamp: timestamp,
              verified: true
            }
          )
          (map-set petition-signatures-count petition-id (+ current-count u1))
          (print { event: "signature-added", petition-id: petition-id, signer: tx-sender })
          (ok true)
        )
      (err ERR-PETITION-NOT-FOUND)
    )
  )
)

(define-public (update-petition (petition-id uint) (new-title (string-ascii 128)) (new-threshold uint))
  (let ((petition (map-get? petitions petition-id)))
    (match petition
      p
        (begin
          (asserts! (is-eq (get creator p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-title new-title))
          (try! (validate-threshold new-threshold))
          (let ((existing (map-get? petitions-by-title new-title)))
            (match existing
              existing-id
                (asserts! (is-eq existing-id petition-id) (err ERR-PETITION-ALREADY-EXISTS))
              true
            )
          )
          (let ((old-title (get title p)))
            (if (is-eq old-title new-title)
                true
                (begin
                  (map-delete petitions-by-title old-title)
                  (map-set petitions-by-title new-title petition-id)
                  true
                )
            )
          )
          (map-set petitions petition-id
            {
              title: new-title,
              description: (get description p),
              threshold: new-threshold,
              deadline: (get deadline p),
              timestamp: block-height,
              creator: (get creator p),
              petition-type: (get petition-type p),
              category: (get category p),
              location: (get location p),
              currency: (get currency p),
              status: (get status p),
              min-support: (get min-support p),
              max-support: (get max-support p)
            }
          )
          (map-set petition-updates petition-id
            {
              update-title: new-title,
              update-threshold: new-threshold,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "petition-updated", id: petition-id })
          (ok true)
        )
      (err ERR-PETITION-NOT-FOUND)
    )
  )
)

(define-public (check-threshold-met (petition-id uint))
  (let (
        (petition (map-get? petitions petition-id))
        (count (get-signatures-count petition-id))
      )
    (match petition
      p
        (if (>= count (get threshold p))
            (ok { met: true, count: count })
            (err ERR-THRESHOLD-NOT-MET)
        )
      (err ERR-PETITION-NOT-FOUND)
    )
  )
)

(define-public (get-petition-count)
  (ok (var-get next-petition-id))
)

(define-public (check-petition-existence (title (string-ascii 128)))
  (ok (is-petition-registered title))
)