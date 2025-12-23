(define (probably-list? e)
  (or (null? e) (pair? e)))

; Data.List.span
(define (span p xs)
  (let loop ((xs xs)
             (prefix '()))
    (if (and (pair? xs)
             (p (car xs)))
      (loop (cdr xs) (cons (car xs) prefix))
      (cons (reverse prefix) xs) )))

(define (replicate n x)
  (let loop ((n n)
             (acc '()))
    (if (> n 0) (loop (- n 1) (cons x acc))
                acc)))

(define -> '())

(define (eval-joy e stack)
  (cond
    ((null? e) stack)
    ((pair? e) (eval-cmd (car e) (cdr e) stack)) ))

(define (eval-cmd cmd k stack)
  (case cmd
    ('dup   (eval-joy k (cons (car stack) stack)))
    ('swap  (eval-joy k (cons (cadr stack)
                              (cons (car stack)
                                    (cddr stack)))))
    ('pop   (eval-joy k (cdr stack)))
    ('cat   (eval-joy k (cons (append (cadr stack) (car stack))
                              (cddr stack))))
    ('quote (eval-joy k (cons (list (car stack)) (cdr stack))))
    ('eval  (eval-joy (append (car stack) k) (cdr stack)))
    ('quota (eval-joy k (cons (map list (car stack)) (cdr stack))))
    (else
      (assert (list? cmd))
      (eval-joy k (cons cmd stack)) )))

; f should be a Scheme function which takes a single symbol and quasiquotes that symbol
; into a larger structure.
; Then (abstract f) returns a corresponding Joy subprogram which implements this function.
(define (abstract f)
  (define argument (gensym))

  ; does this subexpression contain the argument?
  (define (constant? e)
    (cond ((null?   e) -> #t)
          ((symbol? e) -> (not (eqv? e argument)))
          ((pair?   e) -> (and (constant? (car e))
                               (constant? (cdr e)) ))))

  ; goal-stack = list< argument | goal-quote >
  ; goal-quote = list< argument | goal-quote | cmd >
  ; `(pop pop ,a pop pop)

  ; precondition:     remaining :: goal-quote
  ; precondition: not (constant? remaining)
  (define (recurse-goal-quote remaining num-cats)
    (define span-pair (span constant? remaining))
    (define constant-prefix (car span-pair))
    (define varying-suffix  (cdr span-pair))
    (cond
      ((not (null? constant-prefix))
       -> (cons constant-prefix (recurse-goal-quote varying-suffix (+ 1 num-cats))))
      ; by precondition, we know (pair? varying-suffix)
      ((eqv? argument (car varying-suffix))
       -> (cond ((null?     (cdr varying-suffix)) -> (replicate num-cats 'cat))
                ((constant? (cdr varying-suffix)) -> `(,(cdr varying-suffix)
                                                       ,@(replicate (+ 1 num-cats) 'cat) ))
                (else                             -> `(dup
                                                       ,@(recurse-goal-quote (cdr varying-suffix) (+ 1 num-cats)) ))))
      ; we know:
      ; - (car varying-suffix) :: goal-quote
      ; - (not (constant? (car varying-suffix)))
      (else
       -> (cond ((null?     (cdr varying-suffix)) -> `(,@(recurse-goal-quote (car varying-suffix) 0)
                                                       quote
                                                       ,@(replicate num-cats 'cat) ))
                ((constant? (cdr varying-suffix)) -> `(,@(recurse-goal-quote (car varying-suffix) 0)
                                                       quote
                                                       ,(cdr varying-suffix)
                                                       ,@(replicate (+ 1 num-cats) 'cat) ))
                (else                             -> `(dup
                                                       ,@(recurse-goal-quote (car varying-suffix) 0)
                                                       quote swap
                                                       ,@(recurse-goal-quote (cdr varying-suffix) (+ 1 num-cats)) ))))))

  (define (build goal-stack)
    (cond ((constant? goal-stack)           -> (cons 'pop goal-stack))
          ((constant? (car goal-stack))     -> `(,(car goal-stack) swap ,@(build (cdr goal-stack))))
          ((eqv? argument (car goal-stack)) ->
            (if (constant? (cdr goal-stack)) (cdr goal-stack)
                                             (cons 'dup (build (cdr goal-stack))) ))
          ((pair? (car goal-stack))         ->
            (if (constant? (cdr goal-stack)) `(,@(recurse-goal-quote (car goal-stack) 0)
                                               quote
                                               ,@(cdr goal-stack))
                                             `(dup
                                               ,@(recurse-goal-quote (car goal-stack) 0)
                                               quote swap
                                               ,@(build (cdr goal-stack)) )))))

  (build (f argument)) )

(display (abstract (lambda (a) `(,a (,a) (awa)))))
