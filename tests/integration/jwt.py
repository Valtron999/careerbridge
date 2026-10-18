import base64,hmac,hashlib,json,sys,time
S=b'integration-test-secret-integration-test-secret'
b=lambda o: base64.urlsafe_b64encode(json.dumps(o,separators=(',',':')).encode()).rstrip(b'=').decode()
def mint(claims):
    h,p=b({'alg':'HS256','typ':'JWT'}),b({**claims,'exp':int(time.time())+86400})
    return f'{h}.{p}.'+base64.urlsafe_b64encode(hmac.new(S,f'{h}.{p}'.encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
if __name__=='__main__':
    print(mint({'role':sys.argv[1], **({'sub':sys.argv[2]} if len(sys.argv)>2 else {})}))
