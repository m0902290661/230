function unlock() {
    let unclock = document.getElementById('unlock').value;
    if (unclock === '230shsunlock') {
        localStorage.setItem('gmailRegisterForm', '0');
        document.getElementById('gmailRegisterForm').style.display = 'block';
    }
}

function limt() {
    let i = localStorage.getItem('gmailRegisterForm');
    if (i === '1') {
        document.getElementById('join_out').innerHTML = '你已超限，已鎖定';
        lock();
    }
    i = '1'
    localStorage.setItem('gmailRegisterForm', '1');
    console.log(i);
}

function lock() {
    document.getElementById('gmailRegisterForm').style.display = 'none';
}

function check() {
    let i = localStorage.getItem('gmailRegisterForm');
    if (i === null) {
        localStorage.setItem('gmailRegisterForm', '0');
        console.log(localStorage.getItem('gmailRegisterForm'));
    }
    if (i === '1') {
        lock();
    }
}

check();