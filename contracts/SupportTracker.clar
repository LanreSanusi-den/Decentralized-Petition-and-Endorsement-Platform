(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PETITION-ID u101)
(define-constant ERR-INVALID-SUPPORTER u102)
(define-constant ERR-ALREADY-SUPPORTED u103)
(define-constant ERR-PETITION-NOT-FOUND u104)
(define-constant ERR-INVALID-TIMESTAMP u105)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u106)
(define-constant ERR-INVALID-COUNT u107)
(define-constant ERR-INVALID-THRESHOLD u108)
(define-constant ERR-MAX-PETITIONS-EXCEEDED u109)
(define-constant ERR-INVALID-STATUS u110)
(define-constant ERR-INVALID-UPDATE-PARAM u111)
(define-constant ERR_UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-LOCATION u113)
(define-constant ERR-INVALID-CURRENCY u114)
(define-constant ERR-INVALID-GRACE-PERIOD u115)
(define-constant ERR-INVALID-INTEREST-RATE u116)
(define-constant ERR-INVALID-GROUP-TYPE u117)
(define-constant ERR-SUPPORT-ALREADY-EXISTS u118)
(define-constant ERR-INVALID-MIN-SUPPORT u119)
(define-constant ERR-INVALID-MAX-SUPPORT u120)

(define-data-var next-petition-id uint u0)
(define-data-var max-petitions uint u1000)
(define-data-var tracking-fee uint u1000)
(define-data-var authority-contract (optional principal) none)

(define-map petitions
  uint
  {
    name: (string-utf8 100),
    support-count: uint,
    unique-supporters: uint,
    timestamp: uint,
    creator: principal,
    status: bool,
    threshold: uint,
    location: (string-utf8 100),
    currency: (string-utf8 20),
    grace-period: uint,
    interest-rate: uint,
    group-type: (string-utf8 50),
    min-support: uint,
    max-support: uint
  }
)

(define-map petitions-by-name
  (string-utf8 100)
  uint)

(define-map petition-updates
  uint
  {
    update-name: (string-utf8 100),
    update-threshold: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-map supports
  { petition-id: uint, supporter: principal }
  {
    timestamp: uint,
    verified: bool
  }
)

(define-map supporter-petitions
  principal
  (list 100 uint)
)

(define-read-only (get-petition (id uint))
  (map-get? petitions id)
)

(define-read-only (get-petition-updates (id uint))
  (map-get? petition-updates id)
)

(define-read-only (get-support (petition-id uint) (supporter principal))
  (map-get? supports { petition-id: petition-id, supporter: supporter })
)

(define-read-only (get-supporter-petitions (supporter principal))
  (default-to (list) (map-get? supporter-petitions supporter))
)

(define-read-only (get-verified-count (id uint))
  (match (map-get? petitions id)
    p (ok (get support-count p))
    (err ERR-PETITION-NOT-FOUND)
  )
)

(define-read-only (get-unique-supporters (id uint))
  (match (map-get? petitions id)
    p (ok (get unique-supporters p))
    (err ERR-PETITION-NOT-FOUND)
  )
)

(define-read-only (is-petition-registered (name (string-utf8 100)))
  (is-some (map-get? petitions-by-name name))
)

(define-private (validate-name (name (string-utf8 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
    (ok true)
    (err ERR-INVALID-UPDATE-PARAM))
)

(define-private (validate-threshold (threshold uint))
  (if (> threshold u0)
    (ok true)
    (err ERR-INVALID-THRESHOLD))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-status (status bool))
  (ok true)
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
    (ok true)
    (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
    (ok true)
    (err ERR-INVALID-CURRENCY))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
    (ok true)
    (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-interest-rate (rate uint))
  (if (<= rate u20)
    (ok true)
    (err ERR-INVALID-INTEREST-RATE))
)

(define-private (validate-group-type (type (string-utf8 50)))
  (if (or (is-eq type "rural") (is-eq type "urban") (is-eq type "community"))
    (ok true)
    (err ERR-INVALID-GROUP-TYPE))
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

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
    (ok true)
    (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-petitions (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID_UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-petitions new-max)
    (ok true)
  )
)

(define-public (set-tracking-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID_UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set tracking-fee new-fee)
    (ok true)
  )
)

(define-public (register-petition
  (petition-name (string-utf8 100))
  (threshold uint)
  (location (string-utf8 100))
  (currency (string-utf8 20))
  (grace-period uint)
  (interest-rate uint)
  (group-type (string-utf8 50))
  (min-support uint)
  (max-support uint)
)
  (let (
    (next-id (var-get next-petition-id))
    (current-max (var-get max-petitions))
    (authority (var-get authority-contract))
  )
    (asserts! (< next-id current-max) (err ERR-MAX-PETITIONS-EXCEEDED))
    (try! (validate-name petition-name))
    (try! (validate-threshold threshold))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-grace-period grace-period))
    (try! (validate-interest-rate interest-rate))
    (try! (validate-group-type group-type))
    (try! (validate-min-support min-support))
    (try! (validate-max-support max-support))
    (asserts! (is-none (map-get? petitions-by-name petition-name)) (err ERR-SUPPORT-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get tracking-fee) tx-sender authority-recipient))
    )
    (map-set petitions next-id
      {
        name: petition-name,
        support-count: u0,
        unique-supporters: u0,
        timestamp: block-height,
        creator: tx-sender,
        status: true,
        threshold: threshold,
        location: location,
        currency: currency,
        grace-period: grace-period,
        interest-rate: interest-rate,
        group-type: group-type,
        min-support: min-support,
        max-support: max-support
      }
    )
    (map-set petitions-by-name petition-name next-id)
    (var-set next-petition-id (+ next-id u1))
    (print { event: "petition-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (add-verified-support (petition-id uint) (supporter principal))
  (let ((petition (map-get? petitions petition-id)))
    (match petition
      p
      (begin
        (asserts! (get status p) (err ERR-INVALID-STATUS))
        (asserts! (is-none (map-get? supports { petition-id: petition-id, supporter: supporter })) (err ERR-ALREADY-SUPPORTED))
        (map-set supports { petition-id: petition-id, supporter: supporter }
          {
            timestamp: block-height,
            verified: true
          }
        )
        (let (
          (current-count (get support-count p))
          (current-unique (get unique-supporters p))
          (supporter-list (default-to (list) (map-get? supporter-petitions supporter)))
        )
          (map-set petitions petition-id
            (merge p
              {
                support-count: (+ current-count u1),
                unique-supporters: (+ current-unique u1)
              }
            )
          )
          (map-set supporter-petitions supporter (append supporter-list petition-id))
          (print { event: "support-added", petition-id: petition-id, supporter: supporter })
          (ok true)
        )
      )
      (err ERR-PETITION-NOT-FOUND)
    )
  )
)

(define-public (update-petition
  (petition-id uint)
  (update-name (string-utf8 100))
  (update-threshold uint)
)
  (let ((petition (map-get? petitions petition-id)))
    (match petition
      p
      (begin
        (asserts! (is-eq (get creator p) tx-sender) (err ERR-NOT-AUTHORIZED))
        (try! (validate-name update-name))
        (try! (validate-threshold update-threshold))
        (let ((existing (map-get? petitions-by-name update-name)))
          (match existing
            existing-id
            (asserts! (is-eq existing-id petition-id) (err ERR_SUPPORT_ALREADY_EXISTS))
            (begin true)
          )
        )
        (let ((old-name (get name p)))
          (if (is-eq old-name update-name)
            (ok true)
            (begin
              (map-delete petitions-by-name old-name)
              (map-set petitions-by-name update-name petition-id)
              (ok true)
            )
          )
        )
        (map-set petitions petition-id
          (merge p
            {
              name: update-name,
              threshold: update-threshold,
              timestamp: block-height
            }
          )
        )
        (map-set petition-updates petition-id
          {
            update-name: update-name,
            update-threshold: update-threshold,
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

(define-public (get-petition-count)
  (ok (var-get next-petition-id))
)

(define-public (check-petition-existence (name (string-utf8 100)))
  (ok (is-petition-registered name))
)